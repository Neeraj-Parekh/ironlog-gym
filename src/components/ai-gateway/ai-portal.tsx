"use client";
import { useState } from "react";
import { getDB } from "@/lib/dexie";
import { useAppStore } from "@/lib/store/app-store";
import {
  useActiveVersion,
  useExercises,
  useEquipment,
} from "@/hooks/use-routine";
import { sanitizeAIImport, type ImportPayload } from "@/lib/schemas/import-gateway";
import { TAG_CONFIG } from "@/lib/tags";
import type {
  DayOfWeek,
  Exercise,
  RoutineNode,
  ExerciseType,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Copy,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Upload,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import blankSchema from "@/data/blank-schema.json";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function AIPortal() {
  const [pasteText, setPasteText] = useState("");
  const [validated, setValidated] = useState<ImportPayload | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetDay, setTargetDay] = useState<DayOfWeek>(1);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { version } = useActiveVersion();
  const { exercises, reload: reloadExercises } = useExercises();
  const { reload: reloadEquipment } = useEquipment();
  const setView = useAppStore((s) => s.setView);

  // ---- Copy blank schema ----
  const handleCopySchema = async () => {
    const schemaStr = JSON.stringify(blankSchema, null, 2);
    try {
      await navigator.clipboard.writeText(schemaStr);
      setCopied(true);
      toast.success("Blank schema copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = schemaStr;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      toast.success("Blank schema copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Validate pasted JSON ----
  const handleValidate = () => {
    setError(null);
    setWarnings([]);
    setValidated(null);

    if (!pasteText.trim()) {
      setError("Paste a JSON payload first.");
      return;
    }

    const result = sanitizeAIImport(pasteText);
    if (!result.ok) {
      setError(result.error ?? "Unknown validation error");
      return;
    }
    setValidated(result.data!);
    setWarnings(result.warnings);
    toast.success(
      `Validated: ${result.data!.session_payload.exercises_logged.length} exercise(s) ready to import`
    );
  };

  // ---- Import into database ----
  const handleImport = async () => {
    if (!validated || !version) return;
    setImporting(true);

    try {
      const db = getDB();
      const payload = validated.session_payload;
      const newNodes: RoutineNode[] = [];
      const newExercises: Exercise[] = [];
      const exerciseIdMap = new Map<string, string>(); // temp id -> real id

      // Determine sequence start (after existing exercises for this day)
      const existingDayNodes = await db.routine_nodes
        .where("version_id")
        .equals(version.id)
        .filter((n) => n.day_of_week === targetDay && n.block_type === "exercise")
        .toArray();
      let seq = Math.max(0, ...existingDayNodes.map((n) => n.sequence_order)) + 1;

      for (const node of payload.exercises_logged) {
        // Resolve or create exercise record
        let exerciseId = node.equipment_id;
        let existingEx = exercises.find(
          (e) =>
            e.name.toLowerCase() === node.name.toLowerCase() ||
            e.id === node.equipment_id
        );

        if (!existingEx) {
          // Create a new exercise entry
          exerciseId = uid("ex");
          const tag = TAG_CONFIG[node.exercise_type];
          const newEx: Exercise = {
            id: exerciseId,
            name: node.name,
            target_muscle: "imported",
            exercise_type: node.exercise_type,
            equipment_id: node.equipment_id || "none_bodyweight",
            fallback_ids: node.fallback_ids ?? [],
            visual_tag: {
              label: tag.label,
              border_color: tag.border_color,
              bg_color: tag.bg_color,
              icon_identifier: tag.icon_identifier,
            },
          };
          newExercises.push(newEx);
        } else {
          exerciseId = existingEx.id;
        }

        // Build sets_override from metrics.sets if present
        const setsOverride = (node.metrics.sets ?? []).map((s) => ({
          set_number: s.set_index,
          target_reps: s.target_reps ?? s.reps_completed ?? 10,
          target_weight_kg: s.target_weight_kg ?? s.weight_kg ?? 0,
        }));

        const routineNode: RoutineNode = {
          id: uid("node"),
          version_id: version.id,
          day_of_week: targetDay,
          block_type: "exercise",
          sequence_order: seq++,
          exercise_id: exerciseId,
          name: node.name,
          exercise_type: node.exercise_type,
          is_fixed: false,
          sets_count: Math.max(setsOverride.length, 3),
          target_reps_default:
            setsOverride[0]?.target_reps ??
            node.metrics.sets?.[0]?.reps_completed ??
            10,
          prescribed_rest_seconds: 120,
          sets_override: setsOverride,
          fallback_ids: node.fallback_ids ?? [],
          equipment_source: {
            type: node.exercise_type === "machine" ? "machine" : "barbell",
          },
          duration_minutes: node.metrics.duration_minutes,
          intensity_metrics: node.metrics.intensity_metrics as Record<
            string,
            number
          > | undefined,
        } as RoutineNode;

        newNodes.push(routineNode);
      }

      await db.transaction("rw", [db.exercises, db.routine_nodes], async () => {
        if (newExercises.length > 0) {
          await db.exercises.bulkPut(newExercises);
        }
        await db.routine_nodes.bulkPut(newNodes);
      });

      toast.success(
        `Imported ${newNodes.length} exercise(s) into ${DAYS.find((d) => d.value === targetDay)?.label}`
      );

      // Reset
      setPasteText("");
      setValidated(null);
      setWarnings([]);
      await reloadExercises();
      await reloadEquipment();
      useAppStore.getState().setSelectedDay(targetDay);
      setView("day_batch_edit");
    } catch (e) {
      toast.error(
        `Import failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* Step 1: Copy blank schema */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
              1
            </span>
            Copy Schema Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Copy this blank JSON template and paste it to an external AI (ChatGPT,
            Claude, etc). Tell the AI: &quot;Fill in my workout for [day]&quot; and
            it will populate the structure.
          </p>
          <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto max-h-40 overflow-y-auto font-mono">
{JSON.stringify(blankSchema, null, 2)}
          </pre>
          <Button onClick={handleCopySchema} className="w-full gap-1.5">
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Blank Schema Template
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Paste AI output */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
              2
            </span>
            Paste AI-Generated JSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              Target day for import
            </Label>
            <Select
              value={String(targetDay)}
              onValueChange={(v) => setTargetDay(Number(v) as DayOfWeek)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder='Paste the AI-populated JSON here...'
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="min-h-[180px] font-mono text-xs"
          />

          <Button
            onClick={handleValidate}
            variant="outline"
            className="w-full gap-1.5"
            disabled={!pasteText.trim()}
          >
            <FileJson className="h-4 w-4" />
            Validate JSON
          </Button>
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validation Failed</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-xs space-y-0.5 mt-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Validated preview */}
      {validated && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              Validated — Ready to Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Day: <span className="font-medium text-foreground">{validated.session_payload.day_label ?? validated.session_payload.day_identifier}</span>
              {" → "}
              {DAYS.find((d) => d.value === targetDay)?.label}
            </div>
            <div className="space-y-1.5">
              {validated.session_payload.exercises_logged.map((node, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {node.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {node.metrics.sets?.length ?? 0} sets
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        borderColor: TAG_CONFIG[node.exercise_type].border_color,
                        color: TAG_CONFIG[node.exercise_type].border_color,
                        backgroundColor: TAG_CONFIG[node.exercise_type].bg_color,
                      }}
                    >
                      {TAG_CONFIG[node.exercise_type].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full gap-1.5 mt-2"
              size="lg"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Validate & Execute Import"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ClipboardPaste className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">How the AI loop works</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Copy the blank schema template above</li>
                <li>Paste it to an external AI with your workout description</li>
                <li>AI fills in the JSON structure (exercises, sets, reps, weights)</li>
                <li>Paste the AI output back here and validate</li>
                <li>Import populates your selected day instantly</li>
              </ol>
              <p className="mt-2">
                Malformed AI output is auto-sanitized — missing fields get safe defaults.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
