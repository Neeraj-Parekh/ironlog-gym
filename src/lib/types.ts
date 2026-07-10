// ============================================================
// Core Domain Types — Gym Session PWA
// Relational model mirroring the architect spec, persisted in Dexie/IndexedDB.
// ============================================================

export type ExerciseType = "machine" | "non-machine" | "cardio" | "stretching";

export type EquipmentKind = "barbell" | "dumbbell" | "plate" | "machine" | "bodyweight";

export type EquipmentStatus = "AVAILABLE" | "BUSY";

export type MachineWeightType = "pin_stack" | "plate_loaded";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday ... 6 = Saturday

export type BlockType = "pre" | "exercise" | "post";

export type VersioningMode = "this_week_only" | "all_future_weeks";

// ---- Visual tag (derived from exercise_type) ----
export interface VisualTag {
  label: string;
  border_color: string; // hex
  bg_color: string; // hex
  icon_identifier: string; // lucide icon name
}

// ---- Equipment (discriminated by `kind`) ----
export interface BaseEquipment {
  id: string;
  name: string;
  kind: EquipmentKind;
}

export interface BarbellEquipment extends BaseEquipment {
  kind: "barbell";
  weight_kg: number;
}

export interface DumbbellEquipment extends BaseEquipment {
  kind: "dumbbell";
  available_pairs: number[]; // kg values available as pairs
}

export interface PlateEquipment extends BaseEquipment {
  kind: "plate";
  pairs_available: Record<string, number>; // kg -> pair count
}

export interface MachineEquipment extends BaseEquipment {
  kind: "machine";
  weight_type: MachineWeightType;
  stack_increment_kg?: number;
  max_weight_kg?: number;
  base_weight_kg?: number;
  current_status: EquipmentStatus;
}

export type Equipment =
  | BarbellEquipment
  | DumbbellEquipment
  | PlateEquipment
  | MachineEquipment
  | (BaseEquipment & { kind: "bodyweight" });

// ---- Exercise ----
export interface Exercise {
  id: string;
  name: string;
  target_muscle: string;
  exercise_type: ExerciseType;
  equipment_id: string; // FK -> Equipment.id, or "none_bodyweight"
  fallback_ids: string[]; // ordered list of alternative exercise IDs
  visual_tag: VisualTag; // denormalized for fast render
}

// ---- Routine versioning (immutable after creation) ----
export interface RoutineVersion {
  id: string; // version_id, e.g. "v2026_w27_rev1"
  label: string;
  effective_week: string; // ISO week, e.g. "2026-W27"
  created_at: string; // ISO timestamp
  is_active: boolean;
}

// ---- Set override (per-set target) ----
export interface SetOverride {
  set_number: number;
  target_reps: number;
  target_weight_kg: number;
}

// ---- Routine node (a block within a day's plan) ----
export interface RoutineNode {
  id: string;
  version_id: string; // FK -> RoutineVersion.id
  day_of_week: DayOfWeek;
  block_type: BlockType; // pre / exercise / post
  sequence_order: number;
  // For exercise blocks:
  exercise_id?: string; // FK -> Exercise.id
  name: string; // denormalized for fast render
  exercise_type: ExerciseType;
  is_fixed: boolean; // true for locked cardio/stretch blocks
  // Strength metrics:
  sets_count?: number;
  target_reps_default?: number;
  prescribed_rest_seconds?: number;
  sets_override?: SetOverride[];
  fallback_ids?: string[];
  equipment_source?: { type: EquipmentKind; preferred_id?: string };
  // Cardio/stretch metrics:
  duration_minutes?: number;
  intensity_metrics?: {
    incline_gradient?: number;
    speed_kmh?: number;
    [key: string]: number | undefined;
  };
}

// ---- Session (a live or completed workout) ----
export type SessionStatus = "active" | "completed" | "abandoned";

export interface Session {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  started_at: string; // ISO timestamp
  ended_at?: string;
  version_id: string;
  day_label: string;
  day_of_week: DayOfWeek;
  plan_snapshot: RoutineNode[]; // deep copy of the routine at session start
  status: SessionStatus;
  notes?: string; // overall session notes
  // Post-workout ratings:
  energy_rating?: number; // 1-10
  difficulty_rating?: number; // 1-10
  // Cardio details:
  cardio_machine?: string;
  cardio_duration_min?: number;
  cardio_distance?: string; // distance or steps
}

// ---- Logged set (atomic performance record) ----
export interface SessionSet {
  id: string;
  session_id: string; // FK -> Session.id
  node_id: string; // FK -> RoutineNode.id (in snapshot)
  exercise_id?: string;
  exercise_name: string;
  set_index: number;
  weight_kg: number;
  reps_completed: number;
  rest_seconds?: number;
  is_fallback: boolean;
  logged_at: string; // ISO timestamp
  // Extended fields (v3):
  rpe?: number; // Rate of Perceived Exertion 1-10
  tempo?: string; // 4-digit e.g. "3010"
  set_type?: "working" | "warmup" | "dropset" | "failure";
  notes?: string;
}

// ---- Biometrics ----
export type BiometricTier = 1 | 2;
export type BiometricMetric =
  | "body_weight"
  | "height"
  | "muscle_mass"
  | "body_fat_pct"
  | "sleep_hours"
  | "soreness"
  | "mood"
  | "readiness";

export interface Biometric {
  id: string;
  tier: BiometricTier;
  metric: BiometricMetric;
  value: number;
  unit: string;
  logged_at: string; // ISO timestamp
}

// ---- Personal Record (PR) ----
export interface PersonalRecord {
  id: string;
  exercise_id: string;
  exercise_name: string;
  estimated_1rm: number;
  weight_kg: number;
  reps: number;
  session_id: string;
  achieved_at: string; // ISO timestamp
}

// ---- Milestone ----
export type MilestoneType =
  | "total_volume"
  | "session_count"
  | "streak"
  | "first_1rm"
  | "exercise_pr";

export interface Milestone {
  id: string;
  type: MilestoneType;
  label: string;
  description: string;
  achieved_at: string;
  value: number;
  unit: string;
}

// ---- Streak tracking ----
export interface StreakRecord {
  id: string;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string; // ISO date
  updated_at: string;
}

// ---- Water intake ----
export interface WaterIntake {
  id: string;
  amount_ml: number;
  logged_at: string; // ISO timestamp
}

// ---- Day label (user-set, e.g. "Push Day A") ----
export interface DayLabel {
  id: string;
  version_id: string;
  day_of_week: DayOfWeek;
  label: string;
  is_active: boolean;
}

// ---- Routine template (pre-built routines for import) ----
export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  category: "PPL" | "upper_lower" | "full_body" | "531" | "custom";
  difficulty: "beginner" | "intermediate" | "advanced";
  days: number;
  template_data: unknown; // serialized routine structure
}

// ---- Session Soreness (DOMS — next-day tracking) ----
export interface MuscleSorenessEntry {
  muscle: string;
  level: 1 | 2 | 3 | 4 | 5; // 1=none, 5=severe
}

export interface SessionSoreness {
  id: string;
  session_id: string; // FK -> Session.id
  logged_at: string; // ISO timestamp
  overall_level: 1 | 2 | 3 | 4 | 5;
  muscle_entries: MuscleSorenessEntry[];
  hours_after_session: number; // 24-72h window
  notes?: string;
}

// ---- Pre-Workout Context ----
export interface PreWorkoutContext {
  id: string;
  session_id: string; // FK -> Session.id
  logged_at: string;
  // Auto-captured:
  time_of_day: string; // HH:MM
  hours_since_waking: number;
  // User input:
  hours_since_last_meal: number;
  caffeine_mg: number;
  stress_level: 1 | 2 | 3 | 4 | 5;
  hydration_ml: number; // pulled from water tracker at session start
  notes?: string;
}

// ---- Vitality Log (testosterone proxy) ----
// Composite score from self-reported markers that correlate with T
export interface VitalityLog {
  id: string;
  logged_at: string; // morning timestamp
  date: string; // YYYY-MM-DD
  // Core markers (0-3 or 1-5 per the formula):
  morning_erection: 0 | 1 | 2 | 3; // 0=none, 3=strong
  libido: 1 | 2 | 3 | 4 | 5;
  drive: 1 | 2 | 3 | 4 | 5; // aggression/competitive drive
  confidence: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  muscle_fullness: 1 | 2 | 3 | 4 | 5;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  // Computed:
  computed_score: number; // 0-100
  notes?: string;
}

// ---- Edit Log (audit trail for session edits) ----
export interface EditLog {
  id: string;
  session_id: string;
  edited_at: string; // ISO timestamp
  edit_type: "set_weight" | "set_reps" | "set_delete" | "set_add" | "session_note" | "session_delete";
  description: string; // human-readable: "Changed set 2 weight from 80 to 85kg"
  old_value?: string;
  new_value?: string;
}
