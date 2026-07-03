// ============================================================
// Zustand active-session store — the live workout state machine
// Holds a deep copy of the routine plan (data-isolation rule).
// ============================================================
import { create } from "zustand";
import type {
  RoutineNode,
  Session,
  SessionSet,
  DayOfWeek,
} from "@/lib/types";

export interface LoggedSet {
  id: string;
  node_id: string;
  exercise_id?: string;
  exercise_name: string;
  set_index: number;
  weight_kg: number;
  reps_completed: number;
  is_fallback: boolean;
  logged_at: string;
  // Extended (v3):
  rpe?: number;
  tempo?: string;
  set_type?: "working" | "warmup" | "dropset" | "failure";
  notes?: string;
}

export interface RestTimerState {
  active: boolean;
  started_at: number | null; // epoch ms when timer started
  target_end: number | null; // epoch ms when timer should end
  duration_seconds: number; // original duration
  completed: boolean; // true when rest ended (for notification)
  completed_at: number | null;
}

interface ActiveSessionState {
  session: Session | null;
  queue: RoutineNode[]; // mutable execution queue (deep copy)
  currentIndex: number;
  loggedSets: LoggedSet[];
  // Station busy tracking (session-scoped, not persisted)
  busyNodeIds: Set<string>;
  // Rest timer
  restTimer: RestTimerState;
  // Actions
  startSession: (session: Session) => void;
  endSession: () => void;
  logSet: (
    nodeId: string,
    exerciseId: string | undefined,
    exerciseName: string,
    weight: number,
    reps: number,
    isFallback: boolean,
    restSeconds?: number,
    options?: {
      rpe?: number;
      tempo?: string;
      set_type?: "working" | "warmup" | "dropset" | "failure";
      notes?: string;
    }
  ) => void;
  markStationBusy: (nodeId: string) => void;
  unmarkStationBusy: (nodeId: string) => void;
  // Queue manipulation
  deferCurrentToEnd: () => void;
  swapToFallback: (fallbackNode: RoutineNode) => void;
  skipCurrent: () => void;
  goToNext: () => void;
  updateQueueItem: (nodeId: string, patch: Partial<RoutineNode>) => void;
  addExerciseToQueue: (node: RoutineNode) => void;
  // Rest timer
  startRest: (seconds: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  stopRest: () => void;
  markRestCompleted: () => void;
  clearRestCompleted: () => void;
}

const initialRestTimer: RestTimerState = {
  active: false,
  started_at: null,
  target_end: null,
  duration_seconds: 0,
  completed: false,
  completed_at: null,
};

export const useActiveSessionStore = create<ActiveSessionState>((set, get) => ({
  session: null,
  queue: [],
  currentIndex: 0,
  loggedSets: [],
  busyNodeIds: new Set(),
  restTimer: initialRestTimer,

  startSession: (session) => {
    // Deep copy the plan snapshot — template isolation
    const queue = session.plan_snapshot
      .filter((n) => n.block_type === "exercise")
      .map((n) => ({ ...n, sets_override: n.sets_override?.map((s) => ({ ...s })) }));
    set({
      session,
      queue,
      currentIndex: 0,
      loggedSets: [],
      busyNodeIds: new Set(),
      restTimer: initialRestTimer,
    });
  },

  endSession: () => {
    set({
      session: null,
      queue: [],
      currentIndex: 0,
      loggedSets: [],
      busyNodeIds: new Set(),
      restTimer: initialRestTimer,
    });
  },

  logSet: (nodeId, exerciseId, exerciseName, weight, reps, isFallback, restSeconds, options) => {
    const newSet: LoggedSet = {
      id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      node_id: nodeId,
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      set_index: get().loggedSets.filter((s) => s.node_id === nodeId).length + 1,
      weight_kg: weight,
      reps_completed: reps,
      is_fallback: isFallback,
      logged_at: new Date().toISOString(),
      rpe: options?.rpe,
      tempo: options?.tempo,
      set_type: options?.set_type ?? "working",
      notes: options?.notes,
    };
    set({ loggedSets: [...get().loggedSets, newSet] });

    // Auto-start rest timer if requested
    if (restSeconds && restSeconds > 0) {
      get().startRest(restSeconds);
    }
  },

  markStationBusy: (nodeId) => {
    const next = new Set(get().busyNodeIds);
    next.add(nodeId);
    set({ busyNodeIds: next });
  },

  unmarkStationBusy: (nodeId) => {
    const next = new Set(get().busyNodeIds);
    next.delete(nodeId);
    set({ busyNodeIds: next });
  },

  deferCurrentToEnd: () => {
    const { queue, currentIndex } = get();
    if (currentIndex >= queue.length) return;
    const current = queue[currentIndex];
    const rest = queue.filter((_, i) => i !== currentIndex);
    set({
      queue: [...rest, current],
      currentIndex: Math.min(currentIndex, Math.max(0, rest.length - 1)),
    });
  },

  swapToFallback: (fallbackNode) => {
    const { queue, currentIndex } = get();
    if (currentIndex >= queue.length) return;
    // Replace current node with fallback at same position,
    // AND push the original exercise to end of queue (so you come back to it)
    const original = queue[currentIndex];
    const newQueue = [...queue];
    newQueue[currentIndex] = fallbackNode;
    // Only add original to end if it's not already there
    if (!newQueue.some((n) => n.id === original.id && n.id !== fallbackNode.id)) {
      newQueue.push(original);
    }
    set({ queue: newQueue });
  },

  skipCurrent: () => {
    get().goToNext();
  },

  goToNext: () => {
    const { currentIndex, queue } = get();
    set({
      currentIndex: Math.min(currentIndex + 1, queue.length),
      restTimer: initialRestTimer,
    });
  },

  updateQueueItem: (nodeId, patch) => {
    const { queue } = get();
    const newQueue = queue.map((n) =>
      n.id === nodeId ? { ...n, ...patch } : n
    );
    set({ queue: newQueue });
  },

  addExerciseToQueue: (node) => {
    const { queue } = get();
    set({ queue: [...queue, node] });
  },

  startRest: (seconds) => {
    const now = Date.now();
    set({
      restTimer: {
        active: true,
        started_at: now,
        target_end: now + seconds * 1000,
        duration_seconds: seconds,
        completed: false,
        completed_at: null,
      },
    });
  },

  adjustRest: (deltaSeconds) => {
    const { restTimer } = get();
    if (!restTimer.active || !restTimer.target_end) return;
    const newEnd = restTimer.target_end + deltaSeconds * 1000;
    set({
      restTimer: {
        ...restTimer,
        target_end: newEnd,
        duration_seconds: Math.max(
          0,
          Math.round((newEnd - (restTimer.started_at ?? Date.now())) / 1000)
        ),
      },
    });
  },

  stopRest: () => {
    set({ restTimer: initialRestTimer });
  },

  markRestCompleted: () => {
    const { restTimer } = get();
    if (!restTimer.active) return;
    set({
      restTimer: {
        ...restTimer,
        completed: true,
        completed_at: Date.now(),
      },
    });
  },

  clearRestCompleted: () => {
    const { restTimer } = get();
    set({
      restTimer: { ...restTimer, completed: false, completed_at: null },
    });
  },
}));
