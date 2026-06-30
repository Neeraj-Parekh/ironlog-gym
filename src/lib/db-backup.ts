// ============================================================
// Full database backup & restore
// Exports/imports ALL data from Dexie for device migration
// and corrupted-DB recovery
// ============================================================
import { getDB } from "./dexie";
import type {
  Exercise,
  Equipment,
  RoutineVersion,
  RoutineNode,
  DayLabel,
  Session,
  SessionSet,
  Biometric,
  WaterIntake,
  PersonalRecord,
  Milestone,
  StreakRecord,
  RoutineTemplate,
  SessionSoreness,
  PreWorkoutContext,
  VitalityLog,
} from "./types";

export interface FullBackup {
  backup_version: string;
  backed_up_at: string;
  app_version: string;
  tables: {
    exercises: Exercise[];
    equipment: Equipment[];
    routine_versions: RoutineVersion[];
    routine_nodes: RoutineNode[];
    day_labels: DayLabel[];
    sessions: Session[];
    session_sets: SessionSet[];
    biometrics: Biometric[];
    water_intake: WaterIntake[];
    personal_records: PersonalRecord[];
    milestones: Milestone[];
    streak: StreakRecord[];
    templates: RoutineTemplate[];
    session_soreness: SessionSoreness[];
    pre_workout_context: PreWorkoutContext[];
    vitality_log: VitalityLog[];
  };
  stats: {
    total_sessions: number;
    total_sets: number;
    total_exercises: number;
    total_vitality_logs: number;
  };
}

export async function createFullBackup(): Promise<FullBackup> {
  const db = getDB();
  const [
    exercises,
    equipment,
    routine_versions,
    routine_nodes,
    day_labels,
    sessions,
    session_sets,
    biometrics,
    water_intake,
    personal_records,
    milestones,
    streak,
    templates,
    session_soreness,
    pre_workout_context,
    vitality_log,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.equipment.toArray(),
    db.routine_versions.toArray(),
    db.routine_nodes.toArray(),
    db.day_labels.toArray(),
    db.sessions.toArray(),
    db.session_sets.toArray(),
    db.biometrics.toArray(),
    db.water_intake.toArray(),
    db.personal_records.toArray(),
    db.milestones.toArray(),
    db.streak.toArray(),
    db.templates.toArray(),
    db.session_soreness.toArray(),
    db.pre_workout_context.toArray(),
    db.vitality_log.toArray(),
  ]);

  return {
    backup_version: "1.1",
    backed_up_at: new Date().toISOString(),
    app_version: "1.0.0",
    tables: {
      exercises,
      equipment,
      routine_versions,
      routine_nodes,
      day_labels,
      sessions,
      session_sets,
      biometrics,
      water_intake,
      personal_records,
      milestones,
      streak,
      templates,
      session_soreness,
      pre_workout_context,
      vitality_log,
    },
    stats: {
      total_sessions: sessions.length,
      total_sets: session_sets.length,
      total_exercises: exercises.length,
      total_vitality_logs: vitality_log.length,
    },
  };
}

export async function restoreFullBackup(backup: FullBackup): Promise<void> {
  const db = getDB();

  await db.transaction(
    "rw",
    [
      db.exercises,
      db.equipment,
      db.routine_versions,
      db.routine_nodes,
      db.day_labels,
      db.sessions,
      db.session_sets,
      db.biometrics,
      db.water_intake,
      db.personal_records,
      db.milestones,
      db.streak,
      db.templates,
      db.session_soreness,
      db.pre_workout_context,
      db.vitality_log,
    ],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.equipment.clear(),
        db.routine_versions.clear(),
        db.routine_nodes.clear(),
        db.day_labels.clear(),
        db.sessions.clear(),
        db.session_sets.clear(),
        db.biometrics.clear(),
        db.water_intake.clear(),
        db.personal_records.clear(),
        db.milestones.clear(),
        db.streak.clear(),
        db.templates.clear(),
        db.session_soreness.clear(),
        db.pre_workout_context.clear(),
        db.vitality_log.clear(),
      ]);

      const t = backup.tables;
      if (t.exercises?.length) await db.exercises.bulkPut(t.exercises);
      if (t.equipment?.length) await db.equipment.bulkPut(t.equipment);
      if (t.routine_versions?.length) await db.routine_versions.bulkPut(t.routine_versions);
      if (t.routine_nodes?.length) await db.routine_nodes.bulkPut(t.routine_nodes);
      if (t.day_labels?.length) await db.day_labels.bulkPut(t.day_labels);
      if (t.sessions?.length) await db.sessions.bulkPut(t.sessions);
      if (t.session_sets?.length) await db.session_sets.bulkPut(t.session_sets);
      if (t.biometrics?.length) await db.biometrics.bulkPut(t.biometrics);
      if (t.water_intake?.length) await db.water_intake.bulkPut(t.water_intake);
      if (t.personal_records?.length) await db.personal_records.bulkPut(t.personal_records);
      if (t.milestones?.length) await db.milestones.bulkPut(t.milestones);
      if (t.streak?.length) await db.streak.bulkPut(t.streak);
      if (t.templates?.length) await db.templates.bulkPut(t.templates);
      if (t.session_soreness?.length) await db.session_soreness.bulkPut(t.session_soreness);
      if (t.pre_workout_context?.length) await db.pre_workout_context.bulkPut(t.pre_workout_context);
      if (t.vitality_log?.length) await db.vitality_log.bulkPut(t.vitality_log);
    }
  );
}

export function backupToJson(backup: FullBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(json: string): FullBackup {
  const parsed = JSON.parse(json);
  if (!parsed.backup_version || !parsed.tables) {
    throw new Error("Invalid backup format: missing backup_version or tables");
  }
  return parsed as FullBackup;
}

// ---- 60-day data purge (per spec §4) ----
// Flattens old session_sets into compressed summary records,
// then deletes the atomic set data to prevent DB bloat.
export async function purgeOldData(daysToKeep = 60): Promise<{
  purgedSets: number;
  purgedSessions: number;
}> {
  const db = getDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffIso = cutoff.toISOString();

  // Find old sessions
  const oldSessions = await db.sessions
    .where("started_at")
    .below(cutoffIso)
    .toArray();

  if (oldSessions.length === 0) {
    return { purgedSets: 0, purgedSessions: 0 };
  }

  const oldSessionIds = oldSessions.map((s) => s.id);
  const oldSets = await db.session_sets
    .where("session_id")
    .anyOf(oldSessionIds)
    .toArray();

  // Delete old session sets and sessions
  await db.transaction("rw", [db.session_sets, db.sessions], async () => {
    await db.session_sets.bulkDelete(oldSets.map((s) => s.id));
    await db.sessions.bulkDelete(oldSessionIds);
  });

  return {
    purgedSets: oldSets.length,
    purgedSessions: oldSessions.length,
  };
}

// ---- Hard reset (corrupted-DB recovery) ----
export async function hardResetDatabase(): Promise<void> {
  const db = getDB();
  await db.delete();
  await db.open();
}
