"use client";
import { useState, useRef, useEffect } from "react";
import type { SetInputsRef } from "./set-inputs";
import type { Equipment, Exercise, RoutineNode } from "@/lib/types";
import { useAppStore } from "@/lib/store/app-store";
import { useActiveSessionStore } from "@/lib/store/active-session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useEquipment, useExercises } from "@/hooks/use-routine";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { usePreviousSession, useWorkoutTimer } from "@/hooks/use-previous-session";
import { getProgressionSuggestion } from "@/lib/progression";
import { calculateWarmupSets } from "@/lib/warmup-calc";
import { haptic } from "@/lib/haptics";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  Flame,
  Timer,
  Eye,
  List,
  Sparkles,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  RpeNotesSheet,
  PreviousSessionCard,
  WarmupCalcCard,
  ProgressionCard,
} from "./hud-extras";
import { PreWorkoutContextCard } from "./pre-workout-context-card";

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
    goToPrev,
    startRest,
    stopRest,
  } = useActiveSessionStore();
  const { autoStartRest, defaultRestSeconds, showProgressionSuggestions, showWarmupCalc } = useSettingsStore();
  const { equipment } = useEquipment();
  const { exercises } = useExercises();
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
  // RPE + notes for current set
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showRpeNotes, setShowRpeNotes] = useState(false);
  // Session-level notes (entered at session completion)
  const [sessionNotes, setSessionNotes] = useState("");
  // Session completion ratings
  const [energy, setEnergy] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [cardioMachine, setCardioMachine] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  // Next exercise preview + equipment picker + add exercise + exercise list
  const [showNextExercise, setShowNextExercise] = useState(false);
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showQuickStretch, setShowQuickStretch] = useState(false);
  // Edit logged set
  const [editSetId, setEditSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  // Station busy processing lock
  const [busyProcessing, setBusyProcessing] = useState(false);

  // Reset inputs when current node changes — use a keyed child component
  // to avoid setState-in-effect lint rule
  const currentNode = queue[currentIndex];
  const isFinished = currentIndex >= queue.length;
  // Track previous exercise ID to clear fallback preview on advance
  const prevNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = currentNode?.id ?? null;
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== currentId) {
      setFallbackPreview(null);
    }
    prevNodeIdRef.current = currentId;
  }, [currentNode?.id]);

  // Keep screen on during active workout (releases on session end)
  const { isLocked: wakeLocked } = useWakeLock(!!session && !isFinished);

  // Previous session data for current exercise
  const { data: prevSession } = usePreviousSession(
    currentNode?.exercise_id,
    session?.id
  );

  // Workout timer
  const { formatted: workoutTimer } = useWorkoutTimer(
    session?.started_at,
    !!session && !isFinished
  );

  // Progression suggestion for current exercise
  const [progression, setProgression] = useState<{
    suggestedWeight: number;
    suggestedReps: number;
    reason: string;
    trend: "increase" | "maintain" | "deload";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentNode?.exercise_id) {
        setProgression(null);
        return;
      }
      const s = await getProgressionSuggestion(currentNode.exercise_id);
      if (!cancelled) setProgression(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNode?.exercise_id]);

  // RPE/notes are cleared in handleLogSet after each set is logged

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
      haptic("error");
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
        : undefined,
      { rpe: rpe ?? undefined, notes: notes || undefined }
    );
    haptic("success");
    toast.success(`Set ${currentSetNumber} logged: ${w}kg × ${r}${rpe ? ` @ RPE ${rpe}` : ""}`);
    // Reset RPE/notes for next set
    setRpe(null);
    setNotes("");
    setShowNextExercise(false);

    // Auto-advance if last set — but wait for rest timer to finish
    if (isLastSet) {
      // If auto-start rest is on, wait for it; otherwise advance after short delay
      if (!autoStartRest) {
        setTimeout(() => goToNext(), 400);
      }
      // If autoStartRest is on, the rest timer started — user can tap "Skip Rest" to advance
    }
  };

  // ---- Station busy handler ----
  const handleStationBusy = async () => {
    if (!currentNode || busyProcessing) return;
    setBusyProcessing(true);
    haptic("medium");

    // Track which fallbacks we've already tried this session for this exercise
    // to prevent duplicates
    const currentExerciseId = currentNode.exercise_id ?? currentNode.id;
    const triedFallbacks = new Set<string>(
      Array.from(busyNodeIds).filter(id => id.startsWith(currentExerciseId))
    );

    const resolution = await resolveFallback(currentNode, busyNodeIds);
    if (resolution.kind === "available") {
      // Mark this fallback as tried so multi-click doesn't duplicate
      markStationBusy(resolution.node.id);
      setFallbackPreview({
        kind: "available",
        exerciseName: resolution.exercise.name,
      });
      swapToFallback(resolution.node);
      haptic("success");
      toast.success(`Swapped to: ${resolution.exercise.name}`);
    } else if (resolution.kind === "all_busy") {
      setFallbackPreview({ kind: "all_busy", message: resolution.message });
      deferCurrentToEnd();
      haptic("error");
      toast.error(resolution.message);
    } else {
      setFallbackPreview({ kind: "no_fallbacks", message: resolution.message });
      deferCurrentToEnd();
      haptic("error");
      toast.error(resolution.message);
    }
    setBusyProcessing(false);
  };

  // ---- Exercise completion options ----
  const handleComplete = () => {
    haptic("success");
    toast.success(`${currentNode.name} marked complete`);
    skipCurrent();
  };

  const handleSkipPartial = () => {
    haptic("light");
    if (setsForCurrent.length > 0 && setsForCurrent.length < targetSetCount) {
      toast(`Skipped ${currentNode.name}`, {
        description: `Partial: ${setsForCurrent.length}/${targetSetCount} sets completed`,
      });
    } else if (setsForCurrent.length === 0) {
      toast(`Skipped ${currentNode.name}`, {
        description: "No sets completed",
      });
    } else {
      toast(`Skipped ${currentNode.name}`, {
        description: "All sets completed before skip",
      });
    }
    skipCurrent();
  };

  const handleSkipCompletely = () => {
    haptic("light");
    toast(`Skipped ${currentNode.name} entirely`, {
      description: "0 sets logged — will not count toward records",
    });
    skipCurrent();
  };

  // ---- End session ----
  const handleEndSession = async () => {
    setShowEndDialog(false);
    await endAndPersistSession(sessionNotes, {
      energy_rating: energy ?? undefined,
      difficulty_rating: difficulty ?? undefined,
      cardio_machine: cardioMachine || undefined,
      cardio_duration_min: cardioDuration ? Number(cardioDuration) : undefined,
      cardio_distance: cardioDistance || undefined,
    });
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
        {/* Wake lock indicator */}
        {wakeLocked && (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
            title="Screen lock active — screen will stay on"
          >
            <Eye className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">
              {session.day_label}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <span className="flex items-center gap-0.5">
                <Timer className="h-3 w-3" />
                {workoutTimer}
              </span>
              <span>·</span>
              <span>
                {completedExercises}/{totalExercises} ·{" "}
                {totalVolume.toLocaleString()} kg
              </span>
            </div>
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

      {/* Pre-workout context (only shown before first set) */}
      {loggedSets.length === 0 && !isFinished && (
        <PreWorkoutContextCard sessionId={session.id} hydrationMl={0} />
      )}

      {isFinished ? (
        /* ---- Session complete ---- */
        <div className="flex-1 flex flex-col gap-4">
          <div className="text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white mx-auto mb-3">
              <Flag className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold">Session Complete</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {loggedSets.length} sets logged ·{" "}
              {totalVolume.toLocaleString()} kg total volume
            </p>
          </div>

          {/* Post-workout cardio + stretch reminder */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <VisualTagBadge type="cardio" />
              <span className="text-sm font-bold">Post-Workout Phase</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Cardio (20-25 min)</p>
                <div className="space-y-0.5">
                  {["Treadmill 5-6.5 km/h", "Exercise Bike 20 min", "Elliptical 20 min", "Stairmaster 15-20 min"].map((c, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{c}</p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Stretches (hold 20-30s)</p>
                <div className="space-y-0.5">
                  {["Chest, Shoulder, Triceps", "Lat, Hamstring, Quad", "Calf, Hip Flexor, Glute", "Butterfly, Child's pose, Cobra"].map((s, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{s}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cardio details — log what you did */}
          <div className="rounded-xl border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Cardio</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Machine</label>
                <Input
                  value={cardioMachine}
                  onChange={(e) => setCardioMachine(e.target.value)}
                  placeholder="Treadmill"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Time (min)</label>
                <Input
                  type="number"
                  value={cardioDuration}
                  onChange={(e) => setCardioDuration(e.target.value)}
                  placeholder="22"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Distance/Steps</label>
                <Input
                  value={cardioDistance}
                  onChange={(e) => setCardioDistance(e.target.value)}
                  placeholder="2.5 km"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Energy + Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Energy</p>
              <div className="flex gap-0.5">
                {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                  <button
                    key={v}
                    onClick={() => setEnergy(energy === v ? null : v)}
                    className={cn(
                      "flex-1 h-8 rounded text-xs font-bold transition-all",
                      energy === v
                        ? "bg-emerald-500 text-white scale-110"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Difficulty</p>
              <div className="flex gap-0.5">
                {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDifficulty(difficulty === v ? null : v)}
                    className={cn(
                      "flex-1 h-8 rounded text-xs font-bold transition-all",
                      difficulty === v
                        ? "bg-rose-500 text-white scale-110"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Session notes */}
          <div className="w-full">
            <Textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Session notes (optional): How did it feel? Gym crowded? PRs?"
              className="min-h-[60px] text-sm"
            />
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
          {/* ---- Phase indicator (Warm-up → Training → Cardio/Stretch) ---- */}
          <div className="flex items-center gap-1 mb-3">
            <div className={cn("flex-1 h-1.5 rounded-full transition-colors", currentIndex === 0 ? "bg-amber-500" : "bg-amber-500/30")} />
            <div className={cn("flex-1 h-1.5 rounded-full transition-colors", currentIndex > 0 && currentIndex < totalExercises ? "bg-emerald-500" : "bg-emerald-500/30")} />
            <div className={cn("flex-1 h-1.5 rounded-full transition-colors", currentIndex >= totalExercises ? "bg-sky-500" : "bg-sky-500/30")} />
          </div>
          <div className="flex items-center justify-between mb-3 text-[9px] text-muted-foreground">
            <span className={cn(currentIndex === 0 && "text-amber-600 font-bold")}>Warm-up</span>
            <span className={cn(currentIndex > 0 && currentIndex < totalExercises && "text-emerald-600 font-bold")}>Training ({currentIndex}/{totalExercises})</span>
            <span className={cn(currentIndex >= totalExercises && "text-sky-600 font-bold")}>Cardio+Stretch</span>
          </div>

          {/* ---- Warm-up phase (shows before first set of first exercise) ---- */}
          {currentIndex === 0 && setsForCurrent.length === 0 && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <VisualTagBadge type="stretching" />
                  <span className="text-sm font-bold">Warm-up Phase</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowQuickStretch(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Full List
                </Button>
              </div>
              <div className="space-y-1">
                {["Neck mobility × 6 each direction", "Arm circles × 10 forward/back", "Shoulder rolls × 10", "Bodyweight squats × 15", "Walking lunges × 10 each leg", "High knees 20-30 sec", "Butt kicks 20-30 sec"].map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-500/5 px-2 py-1">
                    <span className="text-[10px] font-bold text-amber-600 w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs">{ex}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Complete warm-up, then start your first exercise below ↓
              </p>
            </div>
          )}

          {/* ---- Current exercise card (THE BIG CARD) ---- */}
          <div className="flex-1 flex flex-col">
            {/* Exercise index badge + nav */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Previous exercise button */}
                {currentIndex > 0 && (
                  <button
                    onClick={() => {
                      haptic("light");
                      useActiveSessionStore.getState().goToPrev();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground active:scale-95"
                    title="Previous exercise"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Exercise {currentIndex + 1} of {totalExercises}
                </span>
              </div>
              {currentNode.id.includes("_fb_") && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold uppercase">
                  <Zap className="h-3 w-3" />
                  Fallback
                </span>
              )}
              {/* Next exercise peek */}
              {currentIndex + 1 < queue.length && (
                <button
                  onClick={() => {
                    haptic("light");
                    setShowNextExercise(!showNextExercise);
                  }}
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <Eye className="h-3 w-3" />
                  Next: {queue[currentIndex + 1]?.name}
                </button>
              )}
            </div>

            {/* Next exercise preview (expandable) */}
            {showNextExercise && currentIndex + 1 < queue.length && (
              <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-400 mb-0.5">
                      Up Next
                    </p>
                    <p className="text-sm font-bold">{queue[currentIndex + 1]?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <VisualTagBadge type={queue[currentIndex + 1]?.exercise_type ?? "non-machine"} />
                      <span className="text-xs text-muted-foreground">
                        {queue[currentIndex + 1]?.sets_count ?? 3} sets × {queue[currentIndex + 1]?.target_reps_default ?? 10} reps
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 shrink-0"
                    onClick={() => {
                      haptic("light");
                      setShowNextExercise(false);
                      goToNext();
                    }}
                  >
                    Skip to it
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Name + tag */}
            <h1 className="text-2xl font-bold leading-tight mb-2">
              {currentNode.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <VisualTagBadge type={currentNode.exercise_type} size="md" />
              <span className="text-sm text-muted-foreground">
                Set {currentSetNumber} of {targetSetCount}
              </span>
              {rpe !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
                  <Flame className="h-3 w-3" />
                  RPE {rpe}
                </span>
              )}
            </div>

            {/* Previous session reference */}
            <PreviousSessionCard data={prevSession} currentWeight={displayWeight} />

            {/* Progression suggestion */}
            {showProgressionSuggestions && (
              <ProgressionCard suggestion={progression} />
            )}

            {/* Warm-up calculator */}
            {showWarmupCalc &&
              currentNode.equipment_source?.type === "barbell" &&
              displayWeight > 0 && (
                <WarmupCalcCard
                  sets={calculateWarmupSets(
                    displayWeight,
                    barbellEq?.barWeight ?? 20
                  )}
                  workingWeight={displayWeight}
                />
              )}

            {/* Previous sets logged for this exercise */}
            {setsForCurrent.length > 0 && (
              <div className="mb-4 rounded-lg bg-muted/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground mb-1 px-1">
                  Logged this exercise
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {setsForCurrent.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setEditSetId(s.id); setEditWeight(String(s.weight_kg)); setEditReps(String(s.reps_completed)); }}
                      className="rounded bg-background px-2 py-1 text-xs font-mono active:scale-95 hover:ring-1 hover:ring-foreground/30 transition-all"
                    >
                      {s.weight_kg}kg×{s.reps_completed}
                      {s.rpe && ` @${s.rpe}`}
                      {s.rpe && <span className="text-[8px] ml-0.5" style={{ color: s.rpe >= 9 ? "#ef4444" : s.rpe >= 7 ? "#f59e0b" : "#10b981" }}>({10 - s.rpe} RIR)</span>}
                    </button>
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

            {/* Equipment hint for dumbbells */}
            {currentNode.equipment_source?.type === "dumbbell" && displayWeight > 0 && (
              <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
                <p className="font-medium">Dumbbell setup</p>
                <p className="text-muted-foreground mt-0.5">
                  Grab the <strong>{displayWeight}kg</strong> dumbbell pair
                </p>
              </div>
            )}

            {/* Equipment hint for machines */}
            {currentNode.equipment_source?.type === "machine" && displayWeight > 0 && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs">
                <p className="font-medium">Machine setup</p>
                <p className="text-muted-foreground mt-0.5">
                  Pin at <strong>{displayWeight}kg</strong> on the stack
                </p>
              </div>
            )}

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
                        onClick={() => {
                          const val = plateResult.nearest_lower_kg!;
                          inputsRef.current.weight = val;
                          setDisplayWeight(val);
                        }}
                      >
                        Use {plateResult.nearest_lower_kg}kg
                      </Button>
                    )}
                    {plateResult.nearest_higher_kg !== null && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => {
                          const val = plateResult.nearest_higher_kg!;
                          inputsRef.current.weight = val;
                          setDisplayWeight(val);
                        }}
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
                  {fallbackPreview.kind === "available"
                    ? `Swapped to ${fallbackPreview.exerciseName}`
                    : fallbackPreview.message}
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
              {rpe !== null && (
                <span className="ml-1 rounded bg-emerald-800/50 px-1.5 py-0.5 text-xs">
                  RPE {rpe}
                </span>
              )}
            </Button>

            {/* RPE + Notes button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 h-9"
              onClick={() => setShowRpeNotes(true)}
            >
              <Flame className="h-4 w-4" />
              {rpe !== null ? `RPE ${rpe}` : "Add RPE"}
              {notes && <span className="text-muted-foreground">· Notes</span>}
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

              {/* Exercise completion dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 gap-2"
                  >
                    <SkipForward className="h-5 w-5" />
                    <span className="text-sm font-bold">NEXT ▾</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Exercise Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleComplete} className="gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium">Mark Complete</p>
                      <p className="text-[10px] text-muted-foreground">
                        {setsForCurrent.length}/{targetSetCount} sets logged
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSkipPartial} className="gap-2">
                    <SkipForward className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">Skip (Partial)</p>
                      <p className="text-[10px] text-muted-foreground">
                        {setsForCurrent.length > 0
                          ? `${setsForCurrent.length} sets saved`
                          : "No sets logged yet"}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSkipCompletely} className="gap-2">
                    <X className="h-4 w-4 text-rose-500" />
                    <div>
                      <p className="text-sm font-medium">Skip Entirely</p>
                      <p className="text-[10px] text-muted-foreground">
                        No sets counted
                      </p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tertiary actions: Add set, change equipment, add exercise */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  haptic("light");
                  // Add an extra set by increasing targetSetCount
                  if (currentNode) {
                    const newCount = (currentNode.sets_count ?? 3) + 1;
                    useActiveSessionStore.getState().updateQueueItem(currentNode.id, { sets_count: newCount });
                  }
                  toast.success(`Added extra set — now ${targetSetCount + 1} sets`);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Set
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  haptic("light");
                  if (currentNode && (currentNode.sets_count ?? 3) > 1) {
                    const newCount = (currentNode.sets_count ?? 3) - 1;
                    useActiveSessionStore.getState().updateQueueItem(currentNode.id, { sets_count: newCount });
                    toast.success(`Removed set — now ${newCount} sets`);
                  }
                }}
              >
                <Minus className="h-3.5 w-3.5" />
                Remove Set
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowEquipmentPicker(true)}
              >
                <Dumbbell className="h-3.5 w-3.5" />
                Change Equipment
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowAddExercise(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Exercise
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  haptic("light");
                  setShowExerciseList(true);
                }}
              >
                <List className="h-3.5 w-3.5" />
                Queue ({queue.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-sky-600"
                onClick={() => {
                  haptic("light");
                  // Log cardio as a special set with weight=0
                  if (currentNode) {
                    logSet(
                      `cardio_${Date.now()}`,
                      undefined,
                      "Cardio",
                      0,
                      0,
                      false,
                      undefined,
                      { notes: "Cardio logged mid-workout" }
                    );
                    toast.success("Cardio set logged");
                  }
                }}
              >
                <Activity className="h-3.5 w-3.5" />
                Log Cardio
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-amber-600"
                onClick={() => {
                  haptic("light");
                  setShowQuickStretch(true);
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Quick Stretch
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

      {/* RPE + Notes sheet */}
      <RpeNotesSheet
        open={showRpeNotes}
        onOpenChange={setShowRpeNotes}
        rpe={rpe}
        onRpeChange={(v) => {
          setRpe(v);
          haptic("select");
        }}
        notes={notes}
        onNotesChange={setNotes}
      />

      {/* Rest timer pill (floating) */}
      <RestTimerPill />

      {/* Edit logged set dialog */}
      {editSetId && (
        <Dialog open onOpenChange={() => setEditSetId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Logged Set</DialogTitle>
              <DialogDescription>
                Correct a previously logged set. This will be noted in the edit log.
              </DialogDescription>
            </DialogHeader>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSetId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Update the logged set in the store
                  const { loggedSets } = useActiveSessionStore.getState();
                  const updated = loggedSets.map((s) =>
                    s.id === editSetId
                      ? { ...s, weight_kg: Number(editWeight) || 0, reps_completed: Number(editReps) || 0 }
                      : s
                  );
                  useActiveSessionStore.setState({ loggedSets: updated });
                  haptic("success");
                  toast.success("Set updated");
                  setEditSetId(null);
                }}
              >
                Save Correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Equipment picker dialog */}
      {showEquipmentPicker && currentNode && (
        <EquipmentPicker
          currentNode={currentNode}
          equipment={equipment}
          onChange={(newType, newId) => {
            useActiveSessionStore.getState().updateQueueItem(currentNode.id, {
              equipment_source: { type: newType, preferred_id: newId },
            });
            haptic("success");
            toast.success("Equipment changed");
            setShowEquipmentPicker(false);
          }}
          onClose={() => setShowEquipmentPicker(false)}
        />
      )}

      {/* Add exercise to queue dialog */}
      {showAddExercise && (
        <AddExerciseToQueue
          exercises={exercises}
          onAdd={(ex) => {
            const newNode: RoutineNode = {
              id: `extra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              version_id: session.version_id,
              day_of_week: session.day_of_week,
              block_type: "exercise",
              sequence_order: 999,
              exercise_id: ex.id,
              name: ex.name,
              exercise_type: ex.exercise_type,
              is_fixed: false,
              sets_count: 3,
              target_reps_default: 10,
              prescribed_rest_seconds: 120,
              sets_override: [],
              fallback_ids: ex.fallback_ids,
              equipment_source: { type: ex.equipment_id === "none_bodyweight" ? "bodyweight" : "barbell" },
            } as RoutineNode;
            useActiveSessionStore.getState().addExerciseToQueue(newNode);
            haptic("success");
            toast.success(`${ex.name} added to end of workout`);
            setShowAddExercise(false);
          }}
          onClose={() => setShowAddExercise(false)}
        />
      )}

      {/* Quick stretch sheet (mid-workout pain relief) */}
      <Sheet open={showQuickStretch} onOpenChange={setShowQuickStretch}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto px-4 pb-6" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Quick Stretch
            </SheetTitle>
            <SheetDescription>
              Mid-workout stretches to ease pain. Hold each 15-20 seconds.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2 mt-4">
            {[
              { name: "Chest Stretch", how: "Hand on wall, rotate body away", target: "chest" },
              { name: "Shoulder Stretch", how: "Cross-body, pull arm across", target: "shoulders" },
              { name: "Triceps Stretch", how: "Hand behind head, push elbow", target: "triceps" },
              { name: "Lat Stretch", how: "Hands overhead, lean sideways", target: "back" },
              { name: "Forearm Stretch", how: "Pull fingers back, then down", target: "forearms" },
              { name: "Hamstring Stretch", how: "Straight leg, reach for toes", target: "legs" },
              { name: "Quadriceps Stretch", how: "Pull ankle to glute", target: "legs" },
              { name: "Calf Stretch", how: "Push against wall, heel down", target: "legs" },
              { name: "Hip Flexor Stretch", how: "Lunge position, push hips forward", target: "legs" },
              { name: "Glute Stretch", how: "Figure-4, pull knee to chest", target: "legs" },
              { name: "Neck Stretch", how: "Tilt head to side, hold 10s", target: "neck" },
              { name: "Wrist Circle", how: "Rotate wrists 10 each direction", target: "forearms" },
            ].map((stretch, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-2.5">
                <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{stretch.name}</p>
                  <p className="text-[10px] text-muted-foreground">{stretch.how}</p>
                </div>
                <span className="text-[9px] capitalize rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 shrink-0">
                  {stretch.target}
                </span>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Exercise queue list sheet */}
      <Sheet open={showExerciseList} onOpenChange={setShowExerciseList}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto px-4 pb-6" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Workout Queue ({queue.length})
            </SheetTitle>
            <SheetDescription>
              All exercises in this session. Current position highlighted.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-1.5 mt-4">
            {queue.map((node, i) => {
              const isCurrent = i === currentIndex;
              const isPast = i < currentIndex;
              const loggedForThis = loggedSets.filter((s) => s.node_id === node.id);
              const isCompleted = loggedForThis.length >= (node.sets_count ?? 3);
              return (
                <div
                  key={node.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2.5",
                    isCurrent && "border-foreground ring-1 ring-foreground/30 bg-accent",
                    isPast && "opacity-50",
                    !isCurrent && !isPast && "border-border"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0",
                    isCompleted ? "bg-emerald-500 text-white" : isCurrent ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{node.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <VisualTagBadge type={node.exercise_type} />
                      <span className="text-[10px] text-muted-foreground">
                        {loggedForThis.length}/{node.sets_count ?? 3} sets
                      </span>
                      {node.id.includes("_fb_") && (
                        <span className="text-[9px] font-bold uppercase text-amber-600">Fallback</span>
                      )}
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase text-foreground shrink-0">Now</span>
                  )}
                  {!isCurrent && !isPast && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => {
                        haptic("light");
                        const diff = i - currentIndex;
                        if (diff > 0) {
                          for (let j = 0; j < diff; j++) useActiveSessionStore.getState().goToNext();
                        } else {
                          for (let j = 0; j < Math.abs(diff); j++) useActiveSessionStore.getState().goToPrev();
                        }
                        setShowExerciseList(false);
                      }}
                    >
                      Go
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---- Equipment Picker ----
function EquipmentPicker({
  currentNode,
  equipment,
  onChange,
  onClose,
}: {
  currentNode: RoutineNode;
  equipment: Equipment[];
  onChange: (type: "barbell" | "dumbbell" | "machine" | "bodyweight", preferredId?: string) => void;
  onClose: () => void;
}) {
  const currentType = (currentNode.equipment_source?.type === "plate" ? "barbell" : currentNode.equipment_source?.type) ?? "barbell";
  const barbells = equipment.filter((e) => e.kind === "barbell");
  const machines = equipment.filter((e) => e.kind === "machine");
  const [selectedType, setSelectedType] = useState(currentType);
  const [selectedId, setSelectedId] = useState(currentNode.equipment_source?.preferred_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Change Equipment
          </DialogTitle>
          <DialogDescription>
            Switch between barbell, dumbbell, or machine for this exercise.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* Equipment type */}
          <div className="grid grid-cols-4 gap-1">
            {(["barbell", "dumbbell", "machine", "bodyweight"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedType(t);
                  if (t === "bodyweight") setSelectedId("none_bodyweight");
                  else if (t === "dumbbell") setSelectedId("dumbbell_set_01");
                  else if (t === "barbell") setSelectedId("bar_std_20");
                }}
                className={cn(
                  "h-9 rounded-lg border-2 text-xs font-medium capitalize transition-all active:scale-95",
                  selectedType === t
                    ? "border-foreground bg-accent"
                    : "border-border"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Specific equipment selector */}
          {selectedType === "barbell" && (
            <div className="space-y-1">
              {barbells.map((b) => b.kind === "barbell" && (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border p-2 text-left text-sm active:scale-95",
                    selectedId === b.id ? "border-foreground bg-accent" : "border-border"
                  )}
                >
                  <span>{b.name}</span>
                  <span className="text-xs text-muted-foreground">{b.weight_kg}kg</span>
                </button>
              ))}
            </div>
          )}
          {selectedType === "machine" && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {machines.map((m) => m.kind === "machine" && (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border p-2 text-left text-sm active:scale-95",
                    selectedId === m.id ? "border-foreground bg-accent" : "border-border"
                  )}
                >
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => onChange(selectedType, selectedId)}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Add Exercise to Queue ----
function AddExerciseToQueue({
  exercises,
  onAdd,
  onClose,
}: {
  exercises: Exercise[];
  onAdd: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Exercise to Workout</DialogTitle>
          <DialogDescription>
            Adds to the end of your current workout queue.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
        <div className="flex-1 overflow-y-auto space-y-1 max-h-60">
          {filtered.slice(0, 20).map((ex) => (
            <button
              key={ex.id}
              onClick={() => onAdd(ex)}
              className="w-full flex items-center gap-2 rounded-lg border p-2 text-left hover:bg-accent/50 active:scale-95 transition-all"
            >
              <span className="text-sm font-medium flex-1">{ex.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{ex.target_muscle}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
