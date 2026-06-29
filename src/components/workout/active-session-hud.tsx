"use client";
import { useState, useRef } from "react";
import type { SetInputsRef } from "./set-inputs";
import { useAppStore } from "@/lib/store/app-store";
import { useActiveSessionStore } from "@/lib/store/active-session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useEquipment } from "@/hooks/use-routine";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  startSessionForDay,
  endAndPersistSession,
} from "@/lib/session-helpers";
import { resolveFallback } from "@/lib/fallback-resolver";
import { calculatePlateLoading, resolveBarbellEquipment } from "@/lib/plate-calc";
import { VisualTagBadge } from "@/components/routine/visual-tag-badge";
import { RestTimerPill } from "./rest-timer-pill";
import { SetInputs } from "./set-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  AlertOctagon,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock,
  Dumbbell,
  Plus,
  Minus,
  SkipForward,
  X,
  AlertCircle,
  Zap,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ActiveSessionHUD() {
  const {
    session,
    queue,
    currentIndex,
    loggedSets,
    busyNodeIds,
    restTimer,
    logSet,
    markStationBusy,
    deferCurrentToEnd,
    swapToFallback,
    skipCurrent,
    goToNext,
    startRest,
    stopRest,
  } = useActiveSessionStore();
  const { autoStartRest, defaultRestSeconds } = useSettingsStore();
  const { equipment } = useEquipment();
  const setView = useAppStore((s) => s.setView);

  // Ref-based input sync — SetInputs writes weight/reps here on every change.
  // Read in event handlers only (not during render).
  const inputsRef = useRef<SetInputsRef>({ weight: 0, reps: 0 });
  // Mirror weight in state for plate-calc display (updated via callback)
  const [displayWeight, setDisplayWeight] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [fallbackPreview, setFallbackPreview] = useState<
    | { kind: "available"; exerciseName: string }
    | { kind: "all_busy"; message: string }
    | { kind: "no_fallbacks"; message: string }
    | null
  >(null);

  // Reset inputs when current node changes — use a keyed child component
  // to avoid setState-in-effect lint rule
  const currentNode = queue[currentIndex];
  const isFinished = currentIndex >= queue.length;

  // Keep screen on during active workout (releases on session end)
  useWakeLock(!!session && !isFinished);

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No active session
      </div>
    );
  }

  // ---- Counts for current exercise ----
  const setsForCurrent = currentNode
    ? loggedSets.filter((s) => s.node_id === currentNode.id)
    : [];
  const targetSetCount = currentNode?.sets_count ?? 3;
  const currentSetNumber = setsForCurrent.length + 1;
  const isLastSet = currentSetNumber >= targetSetCount;

  // ---- Plate loading (for barbell exercises) ----
  const barbellEq =
    currentNode?.equipment_source?.type === "barbell"
      ? resolveBarbellEquipment(
          equipment,
          currentNode.equipment_source?.preferred_id
        )
      : null;
  const plateResult =
    barbellEq && displayWeight > 0
      ? calculatePlateLoading(displayWeight, barbellEq.barWeight, barbellEq.plates)
      : null;

  // ---- Log set handler ----
  const handleLogSet = () => {
    if (!currentNode) return;
    const { weight: w, reps: r } = inputsRef.current;
    if (r === 0) {
      toast.error("Enter reps before logging");
      return;
    }
    logSet(
      currentNode.id,
      currentNode.exercise_id,
      currentNode.name,
      w,
      r,
      currentNode.id.includes("_fb_"),
      autoStartRest
        ? currentNode.prescribed_rest_seconds ?? defaultRestSeconds
        : undefined
    );
    toast.success(`Set ${currentSetNumber} logged: ${w}kg × ${r}`);

    // Auto-advance if last set
    if (isLastSet) {
      setTimeout(() => goToNext(), 400);
    }
  };

  // ---- Station busy handler ----
  const handleStationBusy = async () => {
    if (!currentNode) return;
    markStationBusy(currentNode.id);
    const resolution = await resolveFallback(currentNode, busyNodeIds);
    if (resolution.kind === "available") {
      setFallbackPreview({
        kind: "available",
        exerciseName: resolution.exercise.name,
      });
      swapToFallback(resolution.node);
      toast.success(`Swapped to fallback: ${resolution.exercise.name}`);
    } else if (resolution.kind === "all_busy") {
      setFallbackPreview({ kind: "all_busy", message: resolution.message });
      deferCurrentToEnd();
      toast.error(resolution.message);
    } else {
      setFallbackPreview({ kind: "no_fallbacks", message: resolution.message });
      deferCurrentToEnd();
      toast.error(resolution.message);
    }
  };

  // ---- Skip / defer ----
  const handleSkip = () => {
    skipCurrent();
    toast("Exercise skipped", {
      description: "Moved to next in queue",
    });
  };

  // ---- End session ----
  const handleEndSession = async () => {
    setShowEndDialog(false);
    await endAndPersistSession();
    toast.success("Workout complete! Sets saved to records.");
  };

  // ---- Progress stats ----
  const totalExercises = queue.length;
  const completedExercises = Math.min(currentIndex, totalExercises);
  const totalVolume = loggedSets.reduce(
    (sum, s) => sum + s.weight_kg * s.reps_completed,
    0
  );

  return (
    <div className="px-4 py-4 pb-32 min-h-[calc(100vh-200px)] flex flex-col">
      {/* Top progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setShowEndDialog(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground"
          aria-label="End session"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">
              {session.day_label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedExercises}/{totalExercises} ·{" "}
              {totalVolume.toLocaleString()} kg volume
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-foreground transition-all"
              style={{
                width: `${
                  totalExercises > 0
                    ? (completedExercises / totalExercises) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {isFinished ? (
        /* ---- Session complete ---- */
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Flag className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Session Complete</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {loggedSets.length} sets logged ·{" "}
              {totalVolume.toLocaleString()} kg total volume
            </p>
          </div>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            onClick={handleEndSession}
          >
            <Check className="h-5 w-5" />
            Save & Finish
          </Button>
        </div>
      ) : currentNode ? (
        <>
          {/* ---- Current exercise card (THE BIG CARD) ---- */}
          <div className="flex-1 flex flex-col">
            {/* Exercise index badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Exercise {currentIndex + 1} of {totalExercises}
              </span>
              {currentNode.id.includes("_fb_") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold uppercase">
                  <Zap className="h-3 w-3" />
                  Fallback
                </span>
              )}
            </div>

            {/* Name + tag */}
            <h1 className="text-2xl font-bold leading-tight mb-2">
              {currentNode.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <VisualTagBadge type={currentNode.exercise_type} size="md" />
              <span className="text-sm text-muted-foreground">
                Set {currentSetNumber} of {targetSetCount}
              </span>
            </div>

            {/* Previous sets logged for this exercise */}
            {setsForCurrent.length > 0 && (
              <div className="mb-4 rounded-lg bg-muted/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground mb-1 px-1">
                  Logged this exercise
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {setsForCurrent.map((s) => (
                    <span
                      key={s.id}
                      className="rounded bg-background px-2 py-1 text-xs font-mono"
                    >
                      {s.weight_kg}kg×{s.reps_completed}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Target hint */}
            {currentNode.sets_override &&
              currentNode.sets_override.length > 0 &&
              currentNode.sets_override[currentSetNumber - 1] && (
                <div className="mb-4 rounded-lg border border-dashed p-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Target for set {currentSetNumber}:{" "}
                    <span className="font-bold text-foreground">
                      {currentNode.sets_override[currentSetNumber - 1].target_weight_kg}kg ×{" "}
                      {currentNode.sets_override[currentSetNumber - 1].target_reps} reps
                    </span>
                  </p>
                </div>
              )}

            {/* Weight + Reps inputs (OVERSIZED) — keyed to reset on node change */}
            <SetInputs
              key={currentNode.id}
              nodeId={currentNode.id}
              initialWeight={
                currentNode.sets_override?.[0]?.target_weight_kg ??
                (currentNode.equipment_source?.type === "barbell" ? 20 : 0)
              }
              initialReps={
                currentNode.sets_override?.[0]?.target_reps ??
                currentNode.target_reps_default ??
                10
              }
              isBarbell={currentNode.equipment_source?.type === "barbell"}
              inputsRef={inputsRef}
              onWeightChange={setDisplayWeight}
            />

            {/* Plate loading hint */}
            {plateResult && (
              <div
                className={cn(
                  "mb-3 rounded-lg border p-2 text-xs",
                  plateResult.achievable
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                )}
              >
                <p className="font-medium">
                  {plateResult.achievable ? "Plate loading" : "Adjustment needed"}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {plateResult.message}
                </p>
                {!plateResult.achievable && (
                  <div className="flex gap-1.5 mt-1.5">
                    {plateResult.nearest_lower_kg !== null && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() =>
                          setWeight(String(plateResult.nearest_lower_kg))
                        }
                      >
                        Use {plateResult.nearest_lower_kg}kg
                      </Button>
                    )}
                    {plateResult.nearest_higher_kg !== null && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() =>
                          setWeight(String(plateResult.nearest_higher_kg))
                        }
                      >
                        Use {plateResult.nearest_higher_kg}kg
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fallback resolution notice */}
            {fallbackPreview && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {fallbackPreview.kind === "available"
                    ? "Swapped to fallback"
                    : "Station busy"}
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {fallbackPreview.message}
                </p>
              </div>
            )}
          </div>

          {/* ---- ACTION BUTTONS (oversized, thumb-zone) ---- */}
          <div className="mt-4 space-y-2">
            {/* Primary: LOG SET */}
            <Button
              size="lg"
              className="w-full h-16 text-lg font-bold gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleLogSet}
            >
              <Check className="h-6 w-6" />
              LOG SET {currentSetNumber}
            </Button>

            {/* Secondary row */}
            <div className="grid grid-cols-2 gap-2">
              {/* STATION BUSY */}
              <Button
                size="lg"
                variant="outline"
                className="h-14 gap-2 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={handleStationBusy}
              >
                <AlertOctagon className="h-5 w-5" />
                <span className="text-sm font-bold">STATION BUSY</span>
              </Button>

              {/* SKIP / DEFER */}
              <Button
                size="lg"
                variant="outline"
                className="h-14 gap-2"
                onClick={handleSkip}
              >
                <SkipForward className="h-5 w-5" />
                <span className="text-sm font-bold">SKIP</span>
              </Button>
            </div>

            {/* Manual rest timer controls */}
            <div className="flex items-center gap-2 pt-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">
                Rest: {currentNode.prescribed_rest_seconds ?? defaultRestSeconds}s prescribed
              </span>
              {!restTimer.active ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    startRest(
                      currentNode.prescribed_rest_seconds ?? defaultRestSeconds
                    )
                  }
                >
                  Start rest
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    stopRest();
                  }}
                >
                  Stop rest
                </Button>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* End session confirmation */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              {loggedSets.length > 0
                ? `${loggedSets.length} sets will be saved to your records. You can review them in Analytics.`
                : "No sets have been logged yet. The session will be discarded."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              End & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rest timer pill (floating) */}
      <RestTimerPill />
    </div>
  );
}
