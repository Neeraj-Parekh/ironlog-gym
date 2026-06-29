// ============================================================
// Session helpers — create a Session from a routine version + day
// ============================================================
import { getDB } from "@/lib/dexie";
import type { Session, RoutineNode, DayOfWeek } from "@/lib/types";
import { useAppStore } from "@/lib/store/app-store";
import { useActiveSessionStore } from "@/lib/store/active-session-store";

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
 */
export async function endAndPersistSession(): Promise<void> {
  const appStore = useAppStore.getState();
  const sessionStore = useActiveSessionStore.getState();
  const { session, loggedSets } = sessionStore;

  if (!session) return;

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

  sessionStore.endSession();
  appStore.setActiveSessionId(null);
  appStore.setView("active_workout");
}
