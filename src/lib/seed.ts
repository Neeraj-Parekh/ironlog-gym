// ============================================================
// Database seeder — populates Dexie on first run
// Seeds: equipment (from inventory.json), exercises, initial routine
// version, 7-day scaffold (cardio+stretch fixed), demo Push Day.
// ============================================================
import { getDB } from "@/lib/dexie";
import { TAG_CONFIG } from "@/lib/tags";
import type {
  Equipment,
  Exercise,
  RoutineVersion,
  RoutineNode,
  DayLabel,
  ExerciseType,
  DayOfWeek,
} from "@/lib/types";
import inventoryData from "@/data/inventory.json";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ---- Helpers ----
function makeVisualTag(type: ExerciseType) {
  const t = TAG_CONFIG[type];
  return {
    label: t.label,
    border_color: t.border_color,
    bg_color: t.bg_color,
    icon_identifier: t.icon_identifier,
  };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function getISOWeek(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---- Build equipment records from inventory.json ----
function buildEquipment(): Equipment[] {
  const inv = inventoryData.gym_inventory;
  const list: Equipment[] = [];

  for (const bar of inv.barbells) {
    list.push({
      id: bar.id,
      name: bar.name,
      kind: "barbell",
      weight_kg: bar.weight_kg,
    });
  }

  list.push({
    id: "dumbbell_set_01",
    name: "Dumbbell Set",
    kind: "dumbbell",
    available_pairs: inv.dumbbells.available_pairs,
  });

  list.push({
    id: "plate_set_01",
    name: "Weight Plates Set",
    kind: "plate",
    pairs_available: inv.weight_plates.pairs_available,
  });

  for (const m of inv.machines) {
    list.push({
      id: m.id,
      name: m.name,
      kind: "machine",
      weight_type: m.weight_type,
      stack_increment_kg: m.stack_increment_kg,
      max_weight_kg: m.max_weight_kg,
      base_weight_kg: m.base_weight_kg,
      current_status: m.current_status,
    });
  }

  // Bodyweight sentinel
  list.push({
    id: "none_bodyweight",
    name: "Bodyweight",
    kind: "bodyweight",
  });

  return list;
}

// ---- Build exercise catalog (used by the demo Push Day + available for import) ----
function buildExercises(): Exercise[] {
  const defs: Array<{
    id: string;
    name: string;
    muscle: string;
    type: ExerciseType;
    equipment: string;
    fallbacks: string[];
  }> = [
    {
      id: "ex_bench_press",
      name: "Barbell Bench Press",
      muscle: "chest",
      type: "non-machine",
      equipment: "bar_std_20",
      fallbacks: ["ex_pec_deck_fly", "ex_db_incline_press"],
    },
    {
      id: "ex_db_incline_press",
      name: "Incline Dumbbell Press",
      muscle: "chest",
      type: "non-machine",
      equipment: "dumbbell_set_01",
      fallbacks: ["ex_bench_press", "ex_chest_press_machine"],
    },
    {
      id: "ex_db_fly",
      name: "Incline Dumbbell Fly",
      muscle: "chest",
      type: "non-machine",
      equipment: "dumbbell_set_01",
      fallbacks: ["ex_pec_deck_fly"],
    },
    {
      id: "ex_pec_deck_fly",
      name: "Pec Deck Fly",
      muscle: "chest",
      type: "machine",
      equipment: "mach_pec_deck_01",
      fallbacks: ["ex_db_fly", "ex_cable_crossover"],
    },
    {
      id: "ex_chest_press_machine",
      name: "Seated Chest Press Machine",
      muscle: "chest",
      type: "machine",
      equipment: "mach_chest_press_01",
      fallbacks: ["ex_bench_press", "ex_db_incline_press"],
    },
    {
      id: "ex_cable_crossover",
      name: "Cable Crossover",
      muscle: "chest",
      type: "machine",
      equipment: "mach_cable_crossover_01",
      fallbacks: ["ex_pec_deck_fly", "ex_db_fly"],
    },
    {
      id: "ex_tricep_pushdown",
      name: "Cable Tricep Pushdown",
      muscle: "triceps",
      type: "machine",
      equipment: "mach_tricep_pushdown_01",
      fallbacks: [],
    },
    {
      id: "ex_overhead_press",
      name: "Barbell Overhead Press",
      muscle: "shoulders",
      type: "non-machine",
      equipment: "bar_std_20",
      fallbacks: ["ex_shoulder_press_machine"],
    },
    {
      id: "ex_shoulder_press_machine",
      name: "Shoulder Press Machine",
      muscle: "shoulders",
      type: "machine",
      equipment: "mach_shoulder_press_01",
      fallbacks: ["ex_overhead_press"],
    },
    {
      id: "ex_lat_pulldown",
      name: "Lat Pulldown",
      muscle: "back",
      type: "machine",
      equipment: "mach_lat_pulldown_01",
      fallbacks: [],
    },
    {
      id: "ex_leg_press",
      name: "Leg Press 45°",
      muscle: "legs",
      type: "machine",
      equipment: "mach_leg_press_01",
      fallbacks: ["ex_hack_squat"],
    },
    {
      id: "ex_hack_squat",
      name: "Hack Squat",
      muscle: "legs",
      type: "machine",
      equipment: "mach_hack_squat_01",
      fallbacks: ["ex_leg_press"],
    },
    {
      id: "ex_squat",
      name: "Barbell Back Squat",
      muscle: "legs",
      type: "non-machine",
      equipment: "bar_std_20",
      fallbacks: ["ex_leg_press", "ex_hack_squat"],
    },
    {
      id: "ex_leg_curl",
      name: "Seated Leg Curl",
      muscle: "legs",
      type: "machine",
      equipment: "mach_leg_curl_01",
      fallbacks: [],
    },
    {
      id: "ex_leg_extension",
      name: "Leg Extension",
      muscle: "legs",
      type: "machine",
      equipment: "mach_leg_extension_01",
      fallbacks: [],
    },
    {
      id: "ex_pushup",
      name: "Push-Up",
      muscle: "chest",
      type: "non-machine",
      equipment: "none_bodyweight",
      fallbacks: ["ex_bench_press"],
    },
  ];

  return defs.map((d) => ({
    id: d.id,
    name: d.name,
    target_muscle: d.muscle,
    exercise_type: d.type,
    equipment_id: d.equipment,
    fallback_ids: d.fallbacks,
    visual_tag: makeVisualTag(d.type),
  }));
}

// ---- Build the 7-day scaffold + demo Push Day ----
function buildRoutineNodes(
  versionId: string
): { nodes: RoutineNode[]; labels: DayLabel[] } {
  const nodes: RoutineNode[] = [];
  const labels: DayLabel[] = [];
  let seq = 0;

  for (let day = 0; day <= 6; day++) {
    const dow = day as DayOfWeek;
    const dayName = DAY_NAMES[day];

    // Day label
    let label = dayName;
    if (day === 1) label = "Push Day A";
    if (day === 3) label = "Leg Day A";
    if (day === 5) label = "Pull Day A";
    labels.push({
      id: uid("lbl"),
      version_id: versionId,
      day_of_week: dow,
      label,
      is_active: true,
    });

    // Fixed pre-workout: dynamic stretch
    nodes.push({
      id: uid("node"),
      version_id: versionId,
      day_of_week: dow,
      block_type: "pre",
      sequence_order: seq++,
      name: "Dynamic Shoulder Mobility",
      exercise_type: "stretching",
      is_fixed: true,
      duration_minutes: 5,
      visual_tag: undefined as never,
    } as RoutineNode);

    // Exercise block(s)
    if (day === 1) {
      // Demo Push Day — Monday
      const pushExercises = [
        {
          exercise_id: "ex_bench_press",
          name: "Barbell Bench Press",
          sets_count: 4,
          target_reps_default: 8,
          prescribed_rest_seconds: 180,
          sets_override: [
            { set_number: 1, target_reps: 8, target_weight_kg: 80 },
            { set_number: 2, target_reps: 8, target_weight_kg: 80 },
            { set_number: 3, target_reps: 6, target_weight_kg: 85 },
            { set_number: 4, target_reps: 6, target_weight_kg: 85 },
          ],
          fallback_ids: ["ex_pec_deck_fly", "ex_db_incline_press"],
          equipment_source: { type: "barbell" as const, preferred_id: "bar_std_20" },
        },
        {
          exercise_id: "ex_db_incline_press",
          name: "Incline Dumbbell Press",
          sets_count: 3,
          target_reps_default: 10,
          prescribed_rest_seconds: 120,
          sets_override: [],
          fallback_ids: ["ex_chest_press_machine"],
          equipment_source: { type: "dumbbell" as const, preferred_id: "dumbbell_set_01" },
        },
        {
          exercise_id: "ex_tricep_pushdown",
          name: "Cable Tricep Pushdown",
          sets_count: 3,
          target_reps_default: 12,
          prescribed_rest_seconds: 90,
          sets_override: [],
          fallback_ids: [],
          equipment_source: { type: "machine" as const, preferred_id: "mach_tricep_pushdown_01" },
        },
      ];
      for (const ex of pushExercises) {
        nodes.push({
          id: uid("node"),
          version_id: versionId,
          day_of_week: dow,
          block_type: "exercise",
          sequence_order: seq++,
          exercise_id: ex.exercise_id,
          name: ex.name,
          exercise_type: "non-machine",
          is_fixed: false,
          sets_count: ex.sets_count,
          target_reps_default: ex.target_reps_default,
          prescribed_rest_seconds: ex.prescribed_rest_seconds,
          sets_override: ex.sets_override,
          fallback_ids: ex.fallback_ids,
          equipment_source: ex.equipment_source,
          visual_tag: undefined as never,
        } as RoutineNode);
      }
    } else if (day === 3) {
      // Demo Leg Day — Wednesday
      const legExercises = [
        {
          exercise_id: "ex_squat",
          name: "Barbell Back Squat",
          sets_count: 4,
          target_reps_default: 6,
          prescribed_rest_seconds: 240,
          sets_override: [],
          fallback_ids: ["ex_leg_press", "ex_hack_squat"],
          equipment_source: { type: "barbell" as const, preferred_id: "bar_std_20" },
        },
        {
          exercise_id: "ex_leg_press",
          name: "Leg Press 45°",
          sets_count: 3,
          target_reps_default: 12,
          prescribed_rest_seconds: 120,
          sets_override: [],
          fallback_ids: ["ex_hack_squat"],
          equipment_source: { type: "machine" as const, preferred_id: "mach_leg_press_01" },
        },
        {
          exercise_id: "ex_leg_curl",
          name: "Seated Leg Curl",
          sets_count: 3,
          target_reps_default: 12,
          prescribed_rest_seconds: 90,
          sets_override: [],
          fallback_ids: [],
          equipment_source: { type: "machine" as const, preferred_id: "mach_leg_curl_01" },
        },
      ];
      for (const ex of legExercises) {
        nodes.push({
          id: uid("node"),
          version_id: versionId,
          day_of_week: dow,
          block_type: "exercise",
          sequence_order: seq++,
          exercise_id: ex.exercise_id,
          name: ex.name,
          exercise_type: "non-machine",
          is_fixed: false,
          sets_count: ex.sets_count,
          target_reps_default: ex.target_reps_default,
          prescribed_rest_seconds: ex.prescribed_rest_seconds,
          sets_override: ex.sets_override,
          fallback_ids: ex.fallback_ids,
          equipment_source: ex.equipment_source,
          visual_tag: undefined as never,
        } as RoutineNode);
      }
    }
    // Other days: no exercises (empty, ready for AI import)

    // Fixed post-workout: cardio
    nodes.push({
      id: uid("node"),
      version_id: versionId,
      day_of_week: dow,
      block_type: "post",
      sequence_order: seq++,
      name: "Steady State Incline Treadmill",
      exercise_type: "cardio",
      is_fixed: true,
      duration_minutes: 20,
      intensity_metrics: { incline_gradient: 8.0, speed_kmh: 5.5 },
      visual_tag: undefined as never,
    } as RoutineNode);
  }

  return { nodes, labels };
}

// ---- Main seed function ----
export async function seedDatabase(): Promise<void> {
  const db = getDB();

  // Check if already seeded
  const existing = await db.routine_versions.count();
  if (existing > 0) return;

  const versionId = `v_${getISOWeek()}_rev1`;
  const now = new Date().toISOString();

  const version: RoutineVersion = {
    id: versionId,
    label: "Initial Routine",
    effective_week: getISOWeek(),
    created_at: now,
    is_active: true,
  };

  const equipment = buildEquipment();
  const exercises = buildExercises();
  const { nodes, labels } = buildRoutineNodes(versionId);

  await db.transaction(
    "rw",
    [
      db.equipment,
      db.exercises,
      db.routine_versions,
      db.routine_nodes,
      db.day_labels,
    ],
    async () => {
      await db.equipment.bulkPut(equipment);
      await db.exercises.bulkPut(exercises);
      await db.routine_versions.put(version);
      await db.routine_nodes.bulkPut(nodes);
      await db.day_labels.bulkPut(labels);
    }
  );
}

// ---- Reset (for development / "clear all data") ----
export async function resetDatabase(): Promise<void> {
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
      ]);
    }
  );
  await seedDatabase();
}
