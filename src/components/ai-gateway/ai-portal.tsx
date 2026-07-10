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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { uid } from "@/lib/utils";
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

export function AIPortal() {
  const [pasteText, setPasteText] = useState("");
  const [validated, setValidated] = useState<ImportPayload | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [targetDay, setTargetDay] = useState<DayOfWeek>(1);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"ai" | "quick">("ai");
  const [importScope, setImportScope] = useState<"exercises" | "full" | "multiweek">("exercises");
  const [numWeeks, setNumWeeks] = useState("1");

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
      // Clipboard API may fail in insecure contexts; nothing we can do
      toast.error("Copy failed — please select and copy manually");
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
            e.equipment_id === node.equipment_id
        );

        if (!existingEx) {
          // Create a new exercise entry
          exerciseId = uid("ex");
          const tag = TAG_CONFIG[node.exercise_type];
          const newEx: Exercise = {
            id: exerciseId,
            name: node.name,
            target_muscle: node.target_muscle || "imported",
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
          // Merge any new fallback_ids into the existing exercise
          if (node.fallback_ids && node.fallback_ids.length > 0) {
            const merged = [
              ...new Set([...existingEx.fallback_ids, ...node.fallback_ids]),
            ];
            existingEx.fallback_ids = merged;
            await db.exercises.put(existingEx);
          }
        }

        // Build sets_override from metrics.sets if present
        const setsOverride = (node.metrics.sets ?? []).map((s) => ({
          set_number: s.set_index,
          target_reps: s.target_reps ?? s.reps_completed ?? 10,
          target_weight_kg: s.target_weight_kg ?? s.weight_kg ?? 0,
        }));

        // Use per-set rest if available, else exercise default
        const firstSetRest = node.metrics.sets?.[0]?.rest_after_seconds;
        const prescribedRest = firstSetRest ?? 120;

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
          prescribed_rest_seconds: prescribedRest,
          sets_override: setsOverride,
          fallback_ids: node.fallback_ids ?? [],
          equipment_source: {
            type: node.exercise_type === "machine" ? "machine" : "barbell",
            preferred_id:
              node.equipment_id && node.equipment_id !== "none_bodyweight"
                ? node.equipment_id
                : undefined,
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
      {/* Mode toggle: AI Import vs Quick Add */}
      <div className="flex gap-2 p-1 rounded-lg bg-muted/50">
        <button
          onClick={() => setMode("ai")}
          className={cn(
            "flex-1 py-2 rounded-md text-sm font-medium transition-all",
            mode === "ai" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          AI Import
        </button>
        <button
          onClick={() => setMode("quick")}
          className={cn(
            "flex-1 py-2 rounded-md text-sm font-medium transition-all",
            mode === "quick" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Quick Add
        </button>
      </div>

      {mode === "quick" ? (
        <QuickAddMode
          targetDay={targetDay}
          setTargetDay={setTargetDay}
          exercises={exercises}
          version={version}
          onImported={() => {
            useAppStore.getState().setSelectedDay(targetDay);
            setView("day_batch_edit");
          }}
        />
      ) : (
        <>
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
          {/* Import scope dropdown */}
          <div>
            <Label className="text-xs text-muted-foreground">
              What to import
            </Label>
            <Select value={importScope} onValueChange={(v) => setImportScope(v as typeof importScope)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exercises">Exercises only (replace day)</SelectItem>
                <SelectItem value="full">Full routine (exercises + cardio + stretch)</SelectItem>
                <SelectItem value="multiweek">Multi-week plan (N weeks target)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Multi-week option */}
          {importScope === "multiweek" && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Number of weeks to plan
              </Label>
              <Select value={numWeeks} onValueChange={setNumWeeks}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 weeks</SelectItem>
                  <SelectItem value="4">4 weeks (1 month)</SelectItem>
                  <SelectItem value="8">8 weeks (2 months)</SelectItem>
                  <SelectItem value="12">12 weeks (3 months)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                AI will generate a progressive overload plan across {numWeeks} weeks. Each week gets its own routine version.
              </p>
            </div>
          )}

          {/* Target day (hidden for multiweek) */}
          {importScope !== "multiweek" && (
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
          )}

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
            <div className="space-y-2">
              {validated.session_payload.exercises_logged.map((node, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {node.name}
                      </span>
                      {node.is_compound && (
                        <span className="text-[9px] font-bold uppercase bg-foreground text-background px-1 rounded">
                          Compound
                        </span>
                      )}
                    </div>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase shrink-0"
                      style={{
                        borderColor: TAG_CONFIG[node.exercise_type].border_color,
                        color: TAG_CONFIG[node.exercise_type].border_color,
                        backgroundColor: TAG_CONFIG[node.exercise_type].bg_color,
                      }}
                    >
                      {TAG_CONFIG[node.exercise_type].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                    <span>{node.metrics.sets?.length ?? 0} sets</span>
                    {node.target_muscle && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{node.target_muscle}</span>
                      </>
                    )}
                    {node.metrics.sets?.some((s) => s.rpe) && (
                      <>
                        <span>·</span>
                        <span>RPE {Math.max(...node.metrics.sets.filter(s => s.rpe).map(s => s.rpe!))}</span>
                      </>
                    )}
                    {node.fallback_ids && node.fallback_ids.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{node.fallback_ids.length} fallback{node.fallback_ids.length > 1 ? "s" : ""}</span>
                      </>
                    )}
                    {node.superset_with && (
                      <>
                        <span>·</span>
                        <span className="text-violet-500">↔ superset</span>
                      </>
                    )}
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
        </>
      )}
    </div>
  );
}

// ---- Quick Add mode (guided, no JSON) ----
function QuickAddMode({
  targetDay,
  setTargetDay,
  exercises,
  version,
  onImported,
}: {
  targetDay: DayOfWeek;
  setTargetDay: (d: DayOfWeek) => void;
  exercises: Exercise[];
  version: { id: string } | null;
  onImported: () => void;
}) {
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [setsCount, setSetsCount] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(40);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!version || selectedExercises.length === 0) return;
    setImporting(true);
    try {
      const db = getDB();
      const existingNodes = await db.routine_nodes
        .where("version_id")
        .equals(version.id)
        .filter((n) => n.day_of_week === targetDay && n.block_type === "exercise")
        .toArray();
      let seq = Math.max(0, ...existingNodes.map((n) => n.sequence_order)) + 1;

      const newNodes = selectedExercises.map((exId) => {
        const ex = exercises.find((e) => e.id === exId);
        return {
          id: uid("node"),
          version_id: version.id,
          day_of_week: targetDay,
          block_type: "exercise" as const,
          sequence_order: seq++,
          exercise_id: exId,
          name: ex?.name ?? "Exercise",
          exercise_type: ex?.exercise_type ?? ("non-machine" as const),
          is_fixed: false,
          sets_count: setsCount,
          target_reps_default: reps,
          prescribed_rest_seconds: 120,
          sets_override: Array.from({ length: setsCount }, (_, i) => ({
            set_number: i + 1,
            target_reps: reps,
            target_weight_kg: weight,
          })),
          fallback_ids: ex?.fallback_ids ?? [],
        };
      });

      await db.routine_nodes.bulkPut(newNodes);
      toast.success(`Added ${newNodes.length} exercise(s)`);
      onImported();
    } catch (e) {
      toast.error("Failed to add exercises");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Target day
          </label>
          <Select value={String(targetDay)} onValueChange={(v) => setTargetDay(Number(v) as DayOfWeek)}>
            <SelectTrigger>
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

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Search exercises
          </label>
          <Input
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {filtered.slice(0, 20).map((ex) => (
            <button
              key={ex.id}
              onClick={() => {
                setSelectedExercises((prev) =>
                  prev.includes(ex.id)
                    ? prev.filter((id) => id !== ex.id)
                    : [...prev, ex.id]
                );
              }}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg border p-2 text-left transition-all",
                selectedExercises.includes(ex.id)
                  ? "border-foreground bg-accent"
                  : "hover:bg-accent/50"
              )}
            >
              <span className="text-sm font-medium flex-1 truncate">{ex.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{ex.target_muscle}</span>
            </button>
          ))}
        </div>

        {selectedExercises.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Sets</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={setsCount}
                onChange={(e) => setSetsCount(Number(e.target.value))}
                className="h-9 text-center font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Reps</label>
              <Input
                type="number"
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="h-9 text-center font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Weight</label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="h-9 text-center font-semibold"
              />
            </div>
          </div>
        )}

        <Button
          className="w-full gap-1.5"
          disabled={selectedExercises.length === 0 || importing}
          onClick={handleAdd}
        >
          <Upload className="h-4 w-4" />
          {importing ? "Adding..." : `Add ${selectedExercises.length} Exercise${selectedExercises.length > 1 ? "s" : ""}`}
        </Button>
      </CardContent>
    </Card>
  );
}
