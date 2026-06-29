// ============================================================
// Dexie Database — IndexedDB persistent store (offline-first)
// Source of truth for the gym tracker. No server round-trips mid-session.
// ============================================================
import Dexie, { type Table } from "dexie";
import type {
  Exercise,
  Equipment,
  RoutineVersion,
  RoutineNode,
  Session,
  SessionSet,
  Biometric,
  WaterIntake,
  DayLabel,
  PersonalRecord,
  Milestone,
  StreakRecord,
  RoutineTemplate,
} from "./types";

export class GymDB extends Dexie {
  exercises!: Table<Exercise, string>;
  equipment!: Table<Equipment, string>;
  routine_versions!: Table<RoutineVersion, string>;
  routine_nodes!: Table<RoutineNode, string>;
  day_labels!: Table<DayLabel, string>;
  sessions!: Table<Session, string>;
  session_sets!: Table<SessionSet, string>;
  biometrics!: Table<Biometric, string>;
  water_intake!: Table<WaterIntake, string>;
  personal_records!: Table<PersonalRecord, string>;
  milestones!: Table<Milestone, string>;
  streak!: Table<StreakRecord, string>;
  templates!: Table<RoutineTemplate, string>;

  constructor() {
    super("gym_tracker_db");
    this.version(1).stores({
      exercises: "&id, name, exercise_type, equipment_id, target_muscle",
      equipment: "&id, name, kind",
      routine_versions: "&id, effective_week, is_active, created_at",
      routine_nodes:
        "&id, version_id, day_of_week, block_type, sequence_order, exercise_id",
      day_labels: "&id, version_id, day_of_week, is_active",
      sessions: "&id, date, version_id, status, started_at",
      session_sets: "&id, session_id, node_id, exercise_id, logged_at",
      biometrics: "&id, tier, metric, logged_at",
      water_intake: "&id, logged_at",
    });
    // v2: add PR, milestones, streak, templates tables
    this.version(2).stores({
      exercises: "&id, name, exercise_type, equipment_id, target_muscle",
      equipment: "&id, name, kind",
      routine_versions: "&id, effective_week, is_active, created_at",
      routine_nodes:
        "&id, version_id, day_of_week, block_type, sequence_order, exercise_id",
      day_labels: "&id, version_id, day_of_week, is_active",
      sessions: "&id, date, version_id, status, started_at",
      session_sets: "&id, session_id, node_id, exercise_id, logged_at",
      biometrics: "&id, tier, metric, logged_at",
      water_intake: "&id, logged_at",
      personal_records: "&id, exercise_id, achieved_at",
      milestones: "&id, type, achieved_at",
      streak: "&id",
      templates: "&id, name, category, difficulty",
    });
  }
}

// Singleton — Dexie must be instantiated client-side only.
let _db: GymDB | null = null;

export function getDB(): GymDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie database can only be accessed in the browser.");
  }
  if (!_db) {
    _db = new GymDB();
  }
  return _db;
}

export type { GymDB };
