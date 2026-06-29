// ============================================================
// Session helpers — create/end sessions, record PRs/streaks/milestones
// ============================================================
import { getDB } from "@/lib/dexie";
import type { Session, RoutineNode, DayOfWeek } from "@/lib/types";
import { useAppStore } from "@/lib/store/app-store";
import { useActiveSessionStore } from "@/lib/store/active-session-store";
import { computeTotalVolume } from "@/lib/analytics";
import {
  checkAndRecordPRs,
  updateStreak,
  checkMilestones,
} from "@/lib/progression";
import { toast } from "sonner";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Create and start a new workout session from a day's routine.
 * Takes a deep copy of the plan (data-isolation rule).
 */
export async function startSessionForDay(day: DayOfWeek): Promise<string> {
  const db = getDB();
  const appStore = useAppStore.getState();
  const sessionStore = useActiveSessionStore.getState();

  // Get active version
  const version =
    (await db.routine_versions
      .where("is_active")
      .equals(1 as never)
      .first()) ??
    (await db.routine_versions.orderBy("created_at").reverse().first());

  if (!version) throw new Error("No routine version found");

  // Get all nodes for this day
  const allNodes = await db.routine_nodes
    .where("version_id")
    .equals(version.id)
    .toArray();
  const dayNodes = allNodes
    .filter((n) => n.day_of_week === day)
    .sort((a, b) => {
      const order = { pre: 0, exercise: 1, post: 2 };
      if (a.block_type !== b.block_type)
        return order[a.block_type] - order[b.block_type];
      return a.sequence_order - b.sequence_order;
    });

  if (dayNodes.length === 0) throw new Error("No exercises found for this day");

  // Deep copy the plan snapshot
  const planSnapshot: RoutineNode[] = dayNodes.map((n) => ({
    ...n,
    sets_override: n.sets_override?.map((s) => ({ ...s })),
    intensity_metrics: n.intensity_metrics ? { ...n.intensity_metrics } : undefined,
    equipment_source: n.equipment_source ? { ...n.equipment_source } : undefined,
    fallback_ids: n.fallback_ids ? [...n.fallback_ids] : undefined,
  }));

  // Get day label
  const dayLabel = await db.day_labels
    .where("version_id")
    .equals(version.id)
    .filter((l) => l.day_of_week === day && l.is_active)
    .first();

  const today = new Date();
  const session: Session = {
    id: uid("session"),
    date: today.toISOString().slice(0, 10),
    started_at: today.toISOString(),
    version_id: version.id,
    day_label: dayLabel?.label ?? "Workout",
    day_of_week: day,
    plan_snapshot: planSnapshot,
    status: "active",
  };

  // Persist the session record
  await db.sessions.put(session);

  // Start the active session in the store
  sessionStore.startSession(session);
  appStore.setActiveSessionId(session.id);
  appStore.setView("active_session");

  return session.id;
}

/**
 * End and persist the session with all logged sets.
 * Also: records PRs, updates streak, checks milestones.
 */
export async function endAndPersistSession(): Promise<{
  prs: number;
  streak: number;
  milestones: number;
}> {
  const appStore = useAppStore.getState();
  const sessionStore = useActiveSessionStore.getState();
  const { session, loggedSets } = sessionStore;

  if (!session) return { prs: 0, streak: 0, milestones: 0 };

  const db = getDB();
  const now = new Date().toISOString();

  // Persist logged sets
  const sessionSets = loggedSets.map((s) => ({
    id: s.id,
    session_id: session.id,
    node_id: s.node_id,
    exercise_id: s.exercise_id,
    exercise_name: s.exercise_name,
    set_index: s.set_index,
    weight_kg: s.weight_kg,
    reps_completed: s.reps_completed,
    is_fallback: s.is_fallback,
    logged_at: s.logged_at,
  }));

  await db.transaction("rw", [db.sessions, db.session_sets], async () => {
    await db.sessions.update(session.id, {
      status: "completed",
      ended_at: now,
    });
    if (sessionSets.length > 0) {
      await db.session_sets.bulkPut(sessionSets);
    }
  });

  // Record PRs
  const newPRs = await checkAndRecordPRs(session, sessionSets);

  // Update streak
  const streakResult = await updateStreak(session.date);

  // Check milestones (need total volume + session count)
  const sessionVolume = computeTotalVolume(sessionSets);
  const allSessions = await db.sessions
    .where("status")
    .equals("completed" as never)
    .toArray();
  const totalVolume = allSessions.reduce((sum, s) => sum + (s as any).totalVolume ?? 0, 0) + sessionVolume;
  const newMilestones = await checkMilestones(
    totalVolume,
    allSessions.length,
    streakResult.current,
    newPRs
  );

  // Show celebrations
  if (newPRs.length > 0) {
    for (const pr of newPRs) {
      toast.success(`🏆 New PR!`, {
        description: `${pr.exercise_name}: ${pr.weight_kg}kg × ${pr.reps} (est. 1RM: ${pr.estimated_1rm.toFixed(1)}kg)`,
        duration: 6000,
      });
    }
  }

  if (streakResult.isNew && streakResult.current >= 3) {
    toast.success(`🔥 ${streakResult.current}-day streak!`, {
      description: `Longest: ${streakResult.longest} days`,
      duration: 5000,
    });
  }

  for (const m of newMilestones) {
    toast.success(`⭐ Milestone unlocked!`, {
      description: m.label,
      duration: 5000,
    });
  }

  sessionStore.endSession();
  appStore.setActiveSessionId(null);
  appStore.setView("active_workout");

  return {
    prs: newPRs.length,
    streak: streakResult.current,
    milestones: newMilestones.length,
  };
}

// ---- Edit/delete past sessions ----
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDB();
  await db.transaction("rw", [db.sessions, db.session_sets], async () => {
    await db.session_sets.where("session_id").equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

export async function editSessionSet(
  setId: string,
  patch: Partial<{
    weight_kg: number;
    reps_completed: number;
    rpe: number;
    notes: string;
  }>
): Promise<void> {
  const db = getDB();
  await db.session_sets.update(setId, patch);
}

export async function deleteSessionSet(setId: string): Promise<void> {
  const db = getDB();
  await db.session_sets.delete(setId);
}

// ---- Duplicate a day's routine to another day ----
export async function duplicateDay(
  sourceDay: DayOfWeek,
  targetDay: DayOfWeek
): Promise<void> {
  const db = getDB();
  const appStore = useAppStore.getState();
  const version =
    (await db.routine_versions
      .where("is_active")
      .equals(1 as never)
      .first()) ?? (await db.routine_versions.orderBy("created_at").reverse().first());

  if (!version) throw new Error("No active routine version");

  const sourceNodes = await db.routine_nodes
    .where("version_id")
    .equals(version.id)
    .filter((n) => n.day_of_week === sourceDay)
    .toArray();

  // Delete existing target day nodes (exercise blocks only, keep pre/post)
  const targetNodes = await db.routine_nodes
    .where("version_id")
    .equals(version.id)
    .filter((n) => n.day_of_week === targetDay && n.block_type === "exercise")
    .toArray();

  // Copy source exercise nodes to target with new IDs
  const sourceExerciseNodes = sourceNodes.filter(
    (n) => n.block_type === "exercise"
  );
  const newNodes = sourceExerciseNodes.map((n) => ({
    ...n,
    id: uid("node"),
    day_of_week: targetDay,
    sets_override: n.sets_override?.map((s) => ({ ...s })),
  }));

  // Also copy day label
  const sourceLabel = await db.day_labels
    .where("version_id")
    .equals(version.id)
    .filter((l) => l.day_of_week === sourceDay && l.is_active)
    .first();
  const targetLabel = await db.day_labels
    .where("version_id")
    .equals(version.id)
    .filter((l) => l.day_of_week === targetDay && l.is_active)
    .first();

  await db.transaction(
    "rw",
    [db.routine_nodes, db.day_labels],
    async () => {
      // Delete old target exercise nodes
      await db.routine_nodes.bulkDelete(targetNodes.map((n) => n.id));
      // Insert copied nodes
      await db.routine_nodes.bulkPut(newNodes);
      // Update label
      if (sourceLabel && targetLabel) {
        await db.day_labels.update(targetLabel.id, {
          label: `${sourceLabel.label} (copy)`,
        });
      }
    }
  );
}

// ---- Deload week support ----
export async function applyDeloadWeek(
  weekStartDate: string
): Promise<void> {
  // Creates a new routine version with reduced volume (60% of current)
  const db = getDB();
  const currentVersion =
    (await db.routine_versions
      .where("is_active")
      .equals(1 as never)
      .first()) ??
    (await db.routine_versions.orderBy("created_at").reverse().first());

  if (!currentVersion) throw new Error("No active routine version");

  const newVersionId = uid("v_deload");
  const newVersion = {
    ...currentVersion,
    id: newVersionId,
    label: `${currentVersion.label} — Deload`,
    created_at: new Date().toISOString(),
    is_active: true,
    effective_week: weekStartDate,
  };

  // Copy all nodes with reduced volume
  const allNodes = await db.routine_nodes
    .where("version_id")
    .equals(currentVersion.id)
    .toArray();

  const deloadNodes = allNodes.map((n) => ({
    ...n,
    id: uid("node"),
    version_id: newVersionId,
    // Reduce sets by ~40% (keep 60%)
    sets_count: n.sets_count ? Math.max(1, Math.round(n.sets_count * 0.6)) : n.sets_count,
    sets_override: n.sets_override?.slice(
      0,
      Math.max(1, Math.round((n.sets_override?.length ?? 0) * 0.6))
    ),
    // Reduce target weight by 10-15%
    sets_override_weight: undefined, // handled in the map below
  })).map((n) => ({
    ...n,
    sets_override: n.sets_override?.map((s) => ({
      ...s,
      target_weight_kg: Math.round(s.target_weight_kg * 0.85 * 4) / 4, // round to 0.25kg
    })),
  }));

  // Copy day labels
  const allLabels = await db.day_labels
    .where("version_id")
    .equals(currentVersion.id)
    .toArray();
  const newLabels = allLabels.map((l) => ({
    ...l,
    id: uid("lbl"),
    version_id: newVersionId,
  }));

  await db.transaction(
    "rw",
    [db.routine_versions, db.routine_nodes, db.day_labels],
    async () => {
      await db.routine_versions.update(currentVersion.id, { is_active: false });
      await db.routine_versions.put(newVersion);
      await db.routine_nodes.bulkPut(deloadNodes);
      await db.day_labels.bulkPut(newLabels);
    }
  );
}

// ---- Exercise catalog management (edit/delete) ----
export async function deleteExercise(exerciseId: string): Promise<void> {
  const db = getDB();
  // Check if exercise is used in any routine node
  const usedInNodes = await db.routine_nodes
    .where("exercise_id")
    .equals(exerciseId)
    .count();
  if (usedInNodes > 0) {
    throw new Error(
      `Exercise is used in ${usedInNodes} routine node(s). Remove it from routines first.`
    );
  }
  // Remove from any fallback_ids arrays
  const allExercises = await db.exercises.toArray();
  for (const ex of allExercises) {
    if (ex.fallback_ids?.includes(exerciseId)) {
      ex.fallback_ids = ex.fallback_ids.filter((id) => id !== exerciseId);
      await db.exercises.put(ex);
    }
  }
  await db.exercises.delete(exerciseId);
}

export async function updateExercise(
  exerciseId: string,
  patch: Partial<{
    name: string;
    target_muscle: string;
    exercise_type: string;
    fallback_ids: string[];
  }>
): Promise<void> {
  const db = getDB();
  await db.exercises.update(exerciseId, patch);
}
