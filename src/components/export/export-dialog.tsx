"use client";
import { useState } from "react";
import { getDB } from "@/lib/dexie";
import {
  generateSessionMarkdown,
  generateRoutineBackup,
  routineBackupToJson,
} from "@/lib/export-engine";
import {
  useActiveVersion,
  useRoutineNodes,
  useDayLabels,
  useExercises,
  useEquipment,
} from "@/hooks/use-routine";
import { useBiometrics } from "@/hooks/use-biometrics";
import { useSessions } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy, FileText, FileJson, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"session" | "routine">("session");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { version } = useActiveVersion();
  const { nodes } = useRoutineNodes(version?.id);
  const { labels } = useDayLabels(version?.id);
  const { exercises } = useExercises();
  const { equipment } = useEquipment();
  const { sessions } = useSessions();
  const { getLatest } = useBiometrics();

  const handleGenerate = async () => {
    if (mode === "session") {
      const sessionData = sessions.find((s) => s.session.id === selectedSessionId);
      if (!sessionData) {
        toast.error("Select a session first");
        return;
      }
      const latestWeight = getLatest("body_weight");
      const weeklyVolume = sessions
        .filter((s) => {
          const sessionDate = new Date(s.session.started_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return sessionDate >= weekAgo;
        })
        .reduce(
          (sum, s) =>
            sum +
            s.sets.reduce((ss, set) => ss + set.weight_kg * set.reps_completed, 0),
          0
        );
      const md = generateSessionMarkdown({
        session: sessionData.session,
        sets: sessionData.sets,
        latestBodyweight: latestWeight,
        weeklyVolume,
      });
      setPreview(md);
    } else {
      if (!version) {
        toast.error("No active routine version");
        return;
      }
      const dayLabels = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        label: labels[i as 0 | 1 | 2 | 3 | 4 | 5 | 6],
        is_active: true,
      }));
      const backup = generateRoutineBackup(
        version,
        nodes,
        dayLabels,
        exercises,
        equipment
      );
      setPreview(routineBackupToJson(backup));
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    const ext = mode === "session" ? "md" : "json";
    const filename =
      mode === "session"
        ? `ironlog-session-${selectedSessionId.slice(0, 8)}.md`
        : `ironlog-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([preview], {
      type: mode === "session" ? "text/markdown" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Generate clipboard-ready output for external AI or backup.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={mode === "session" ? "default" : "outline"}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => {
              setMode("session");
              setPreview("");
            }}
          >
            <FileText className="h-4 w-4" />
            Session MD
          </Button>
          <Button
            variant={mode === "routine" ? "default" : "outline"}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => {
              setMode("routine");
              setPreview("");
            }}
          >
            <FileJson className="h-4 w-4" />
            Routine JSON
          </Button>
        </div>

        {mode === "session" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Select session
            </label>
            <Select
              value={selectedSessionId}
              onValueChange={setSelectedSessionId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a completed session..." />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(({ session, sets }) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.day_label} —{" "}
                    {new Date(session.started_at).toLocaleDateString()} (
                    {sets.length} sets)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No completed sessions yet. Finish a workout first.
              </p>
            )}
          </div>
        )}

        <Button onClick={handleGenerate} disabled={mode === "session" && !selectedSessionId}>
          Generate
        </Button>

        {preview && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Preview ({preview.length} chars)
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={handleDownload}
                >
                  <Download className="h-3 w-3" />
                  Save
                </Button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto rounded-lg bg-muted p-2.5 text-[10px] font-mono max-h-64 whitespace-pre-wrap break-words">
              {preview}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
