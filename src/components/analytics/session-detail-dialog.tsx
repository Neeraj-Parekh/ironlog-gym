"use client";
import { useState, useEffect } from "react";
import { getDB } from "@/lib/dexie";
import type { Session, SessionSet, EditLog } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisualTagBadge } from "@/components/routine/visual-tag-badge";
import { Pencil, Trash2, AlertTriangle, History, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn, uid } from "@/lib/utils";

export function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [editLogs, setEditLogs] = useState<EditLog[]>([]);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const db = getDB();
      const s = await db.sessions.get(sessionId);
      const ss = await db.session_sets.where("session_id").equals(sessionId).toArray();
      const logs = await db.edit_log.where("session_id").equals(sessionId).sortBy("edited_at");
      ss.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      if (!cancelled) {
        setSession(s ?? null);
        setSets(ss);
        setEditLogs(logs.reverse());
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, reloadTick]);

  const handleEditSet = async (setId: string) => {
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    setShowEditWarning(true);
    setEditingSetId(setId);
    setEditWeight(String(set.weight_kg));
    setEditReps(String(set.reps_completed));
  };

  const confirmEditSet = async () => {
    if (!editingSetId || !session) return;
    const db = getDB();
    const oldSet = sets.find((s) => s.id === editingSetId);
    if (!oldSet) return;

    const newWeight = Number(editWeight) || 0;
    const newReps = Number(editReps) || 0;

    await db.session_sets.update(editingSetId, {
      weight_kg: newWeight,
      reps_completed: newReps,
    });

    // Log the edit
    const log: EditLog = {
      id: uid("edit"),
      session_id: session.id,
      edited_at: new Date().toISOString(),
      edit_type: "set_weight",
      description: `Changed ${oldSet.exercise_name} set ${oldSet.set_index}: ${oldSet.weight_kg}kg×${oldSet.reps_completed} → ${newWeight}kg×${newReps}`,
      old_value: `${oldSet.weight_kg}kg×${oldSet.reps_completed}`,
      new_value: `${newWeight}kg×${newReps}`,
    };
    await db.edit_log.put(log);

    toast.success("Set updated — logged in edit history");
    setShowEditWarning(false);
    setEditingSetId(null);
    setReloadTick((t) => t + 1);
  };

  const handleDeleteSet = async (setId: string) => {
    if (!session) return;
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    const db = getDB();
    await db.session_sets.delete(setId);

    const log: EditLog = {
      id: uid("edit"),
      session_id: session.id,
      edited_at: new Date().toISOString(),
      edit_type: "set_delete",
      description: `Deleted ${set.exercise_name} set ${set.set_index} (${set.weight_kg}kg×${set.reps_completed})`,
      old_value: `${set.weight_kg}kg×${set.reps_completed}`,
    };
    await db.edit_log.put(log);

    toast.success("Set deleted — logged in edit history");
    setReloadTick((t) => t + 1);
  };

  if (!session) return null;

  // Group sets by exercise
  const byExercise = new Map<string, SessionSet[]>();
  for (const s of sets) {
    if (!byExercise.has(s.exercise_name)) byExercise.set(s.exercise_name, []);
    byExercise.get(s.exercise_name)!.push(s);
  }

  const totalVolume = sets.reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Session Details
            </DialogTitle>
            <DialogDescription>
              {session.day_label} · {new Date(session.started_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              {" · "}
              {totalVolume.toLocaleString()}kg total
            </DialogDescription>
          </DialogHeader>

          {/* Exercise sets */}
          <div className="space-y-3">
            {Array.from(byExercise.entries()).map(([exerciseName, exSets]) => (
              <div key={exerciseName} className="rounded-lg border p-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold flex-1">{exerciseName}</span>
                  {exSets[0] && <VisualTagBadge type={exSets[0].is_fallback ? "machine" : "non-machine"} />}
                </div>
                <div className="space-y-1">
                  {exSets.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1">
                      <span className="text-[10px] font-bold text-muted-foreground w-6">S{s.set_index}</span>
                      <span className="text-xs font-mono flex-1">
                        {s.weight_kg}kg × {s.reps_completed}
                        {s.rpe && ` @RPE ${s.rpe}`}
                      </span>
                      <button
                        onClick={() => handleEditSet(s.id)}
                        className="text-muted-foreground hover:text-foreground active:scale-95"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteSet(s.id)}
                        className="text-muted-foreground hover:text-destructive active:scale-95"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Session notes */}
          {session.notes && (
            <div className="rounded-lg border p-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Notes</p>
              <p className="text-xs">{session.notes}</p>
            </div>
          )}

          {/* Edit log toggle */}
          {editLogs.length > 0 && (
            <div>
              <button
                onClick={() => setShowLog(!showLog)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="h-3.5 w-3.5" />
                Edit History ({editLogs.length})
              </button>
              {showLog && (
                <div className="mt-2 space-y-1 rounded-lg bg-muted/30 p-2">
                  {editLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-[10px]">
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.edited_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>{log.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Energy/Difficulty/Cardio */}
          {(session.energy_rating || session.difficulty_rating || session.cardio_machine) && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {session.energy_rating && (
                <div className="rounded bg-muted/30 p-1.5">
                  <p className="text-[9px] uppercase text-muted-foreground">Energy</p>
                  <p className="font-bold">{session.energy_rating}/10</p>
                </div>
              )}
              {session.difficulty_rating && (
                <div className="rounded bg-muted/30 p-1.5">
                  <p className="text-[9px] uppercase text-muted-foreground">Difficulty</p>
                  <p className="font-bold">{session.difficulty_rating}/10</p>
                </div>
              )}
              {session.cardio_machine && (
                <div className="rounded bg-muted/30 p-1.5">
                  <p className="text-[9px] uppercase text-muted-foreground">Cardio</p>
                  <p className="font-bold">{session.cardio_machine}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit warning dialog */}
      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Edit Historical Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to modify a set from a completed session. This will
              change your records and affect analytics. The edit will be logged
              in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs">Weight (kg)</Label>
              <Input
                type="number"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                className="mt-1 text-center font-bold"
              />
            </div>
            <div>
              <Label className="text-xs">Reps</Label>
              <Input
                type="number"
                value={editReps}
                onChange={(e) => setEditReps(e.target.value)}
                className="mt-1 text-center font-bold"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEditSet}>
              Save & Log Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
