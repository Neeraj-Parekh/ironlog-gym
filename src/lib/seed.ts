// ============================================================
// Database seeder — populates Dexie on first run
// Seeds:
//   • Equipment (built from inventory.json — unchanged)
//   • Full Physc Gym exercise catalog (39 exercises across 7 muscles)
//   • 6-day training split:
//       Mon=Legs, Tue=Shoulders, Wed=Back, Thu=Biceps,
//       Fri=Chest, Sat=Triceps, Sun=Rest Day
//   • Fixed daily blocks: 8-min dynamic warm-up (pre) + 22-min
//     steady-state cardio (post) on every training day
//   • User baseline biometrics (height 168cm / weight 59.3kg / 14% BF)
// ============================================================
import { getDB } from "@/lib/dexie";
import { TAG_CONFIG } from "@/lib/tags";
import type {
  Biometric,
  Equipment,
  EquipmentKind,
  EquipmentStatus,
  Exercise,
  ExerciseType,
  DayLabel,
  DayOfWeek,
  MachineWeightType,
  RoutineNode,
  RoutineVersion,
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

// Resolve equipment_source from an equipment id.
// - bar_*      → barbell
// - dumbbell_* → dumbbell
// - mach_* / treadmill_* → machine
// - none_bodyweight → bodyweight
function equipmentSourceFor(equipmentId: string): {
  type: EquipmentKind;
  preferred_id?: string;
} {
  if (equipmentId === "none_bodyweight") return { type: "bodyweight" };
  if (equipmentId.startsWith("bar_")) {
    return { type: "barbell", preferred_id: equipmentId };
  }
  if (equipmentId.startsWith("dumbbell_")) {
    return { type: "dumbbell", preferred_id: equipmentId };
  }
  // mach_* and treadmill_*
  return { type: "machine", preferred_id: equipmentId };
}

// ---- Build equipment records from inventory.json (unchanged) ----
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
      weight_type: m.weight_type as MachineWeightType,
      stack_increment_kg: m.stack_increment_kg,
      max_weight_kg: m.max_weight_kg,
      base_weight_kg: m.base_weight_kg,
      current_status: m.current_status as EquipmentStatus,
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

// ============================================================
// Exercise catalog — full Physc Gym split
// Every exercise has a primary equipment id and an ordered
// fallback list (used by the fallback resolver when the primary
// station is busy). Variants (e.g. broad/narrow grip pulldown)
// are separate catalog entries that share the same machine.
// ============================================================
type ExerciseDef = {
  id: string;
  name: string;
  muscle: string;
  type: ExerciseType;
  equipment: string;
  fallbacks: string[];
};

const EXERCISE_DEFS: ExerciseDef[] = [
  // ---- Legs (Monday) ----
  {
    id: "ex_squat",
    name: "Barbell Back Squat",
    muscle: "legs",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_leg_press", "ex_hack_squat"],
  },
  {
    id: "ex_lunges",
    name: "Dumbbell Lunges",
    muscle: "legs",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_squat"],
  },
  {
    id: "ex_leg_press",
    name: "Leg Press 45°",
    muscle: "legs",
    type: "machine",
    equipment: "mach_leg_press_01",
    fallbacks: ["ex_hack_squat", "ex_squat"],
  },
  {
    id: "ex_hack_squat",
    name: "Hack Squat",
    muscle: "legs",
    type: "machine",
    equipment: "mach_hack_squat_01",
    fallbacks: ["ex_leg_press", "ex_squat"],
  },
  {
    id: "ex_seated_calf_raise",
    name: "Seated Calf Raise",
    muscle: "calves",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: [],
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

  // ---- Shoulders (Tuesday) ----
  {
    id: "ex_overhead_press",
    name: "Barbell Overhead Press",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_shoulder_press_machine", "ex_db_shoulder_press"],
  },
  {
    id: "ex_shoulder_press_machine",
    name: "Shoulder Press Machine",
    muscle: "shoulders",
    type: "machine",
    equipment: "mach_shoulder_press_01",
    fallbacks: ["ex_overhead_press", "ex_db_shoulder_press"],
  },
  {
    id: "ex_db_shoulder_press",
    name: "Dumbbell Shoulder Press",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_overhead_press", "ex_shoulder_press_machine"],
  },
  {
    id: "ex_db_lateral_raise",
    name: "Dumbbell Lateral Raise",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: [],
  },
  {
    id: "ex_db_front_raise",
    name: "Dumbbell Front Raise",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: [],
  },
  {
    id: "ex_rear_delt_fly",
    name: "Rear Delt Cable Fly",
    muscle: "shoulders",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: ["ex_db_rear_delt_fly"],
  },
  {
    id: "ex_db_rear_delt_fly",
    name: "Dumbbell Rear Delt Fly",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_rear_delt_fly"],
  },

  // ---- Back (Wednesday) ----
  {
    id: "ex_lat_pulldown_broad",
    name: "Lat Pulldown (Broad Grip)",
    muscle: "back",
    type: "machine",
    equipment: "mach_lat_pulldown_01",
    fallbacks: ["ex_lat_pulldown_narrow"],
  },
  {
    id: "ex_lat_pulldown_narrow",
    name: "Lat Pulldown (Narrow Grip)",
    muscle: "back",
    type: "machine",
    equipment: "mach_lat_pulldown_01",
    fallbacks: ["ex_lat_pulldown_broad"],
  },
  {
    id: "ex_seated_row",
    name: "Cable Seated Row",
    muscle: "back",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: ["ex_barbell_row"],
  },
  {
    id: "ex_tbar_row",
    name: "T-Bar Row",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_barbell_row", "ex_seated_row"],
  },
  {
    id: "ex_barbell_row",
    name: "Barbell Bent-Over Row",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_seated_row", "ex_tbar_row"],
  },
  {
    id: "ex_db_shrugs",
    name: "Dumbbell Shrugs",
    muscle: "back",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_barbell_shrug"],
  },
  {
    id: "ex_barbell_shrug",
    name: "Barbell Shrug",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_db_shrugs"],
  },

  // ---- Biceps (Thursday) ----
  {
    id: "ex_ez_curl",
    name: "EZ Bar Biceps Curl",
    muscle: "biceps",
    type: "non-machine",
    equipment: "bar_ez_10",
    fallbacks: ["ex_db_curl"],
  },
  {
    id: "ex_db_curl",
    name: "Dumbbell Biceps Curl",
    muscle: "biceps",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_ez_curl"],
  },
  {
    id: "ex_incline_db_curl",
    name: "Incline Dumbbell Curl",
    muscle: "biceps",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_db_curl"],
  },
  {
    id: "ex_preacher_curl",
    name: "Preacher Curl Machine",
    muscle: "biceps",
    type: "machine",
    equipment: "mach_bicep_curl_01",
    fallbacks: ["ex_ez_curl", "ex_db_curl"],
  },
  {
    id: "ex_reverse_cable_curl",
    name: "Reverse Cable Curl",
    muscle: "biceps",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: ["ex_ez_curl"],
  },

  // ---- Chest (Friday) ----
  {
    id: "ex_bench_press",
    name: "Barbell Bench Press",
    muscle: "chest",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_chest_press_machine", "ex_db_incline_press"],
  },
  {
    id: "ex_db_incline_press",
    name: "Incline Dumbbell Press",
    muscle: "chest",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_chest_press_machine", "ex_bench_press"],
  },
  {
    id: "ex_decline_press",
    name: "Decline Barbell Press",
    muscle: "chest",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_bench_press", "ex_chest_press_machine"],
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
    id: "ex_pec_deck_fly",
    name: "Pec Deck Fly",
    muscle: "chest",
    type: "machine",
    equipment: "mach_pec_deck_01",
    fallbacks: ["ex_cable_crossover", "ex_db_fly"],
  },
  {
    id: "ex_cable_crossover",
    name: "Cable Crossover",
    muscle: "chest",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: ["ex_pec_deck_fly"],
  },
  {
    id: "ex_db_fly",
    name: "Dumbbell Fly",
    muscle: "chest",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_pec_deck_fly"],
  },
  {
    id: "ex_db_pullover",
    name: "Dumbbell Pullover",
    muscle: "chest",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_cable_crossover"],
  },

  // ---- Triceps (Saturday) ----
  {
    id: "ex_tricep_pushdown",
    name: "Cable Tricep Pushdown",
    muscle: "triceps",
    type: "machine",
    equipment: "mach_tricep_pushdown_01",
    fallbacks: ["ex_cable_crossover"],
  },
  {
    id: "ex_tricep_dip_machine",
    name: "Triceps Dip Machine",
    muscle: "triceps",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: ["ex_tricep_pushdown"],
  },
  {
    id: "ex_french_curl",
    name: "French Curl (EZ Bar Skull Crusher)",
    muscle: "triceps",
    type: "non-machine",
    equipment: "bar_ez_10",
    fallbacks: ["ex_db_skullcrusher", "ex_tricep_pushdown"],
  },
  {
    id: "ex_db_skullcrusher",
    name: "Dumbbell Skull Crusher",
    muscle: "triceps",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_french_curl"],
  },
  {
    id: "ex_tricep_kickback",
    name: "Triceps Kickback",
    muscle: "triceps",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_cable_crossover"],
  },
];

// Lookup map for routine builder (id → def)
const EXERCISE_MAP: Record<string, ExerciseDef> = Object.fromEntries(
  EXERCISE_DEFS.map((d) => [d.id, d])
);

function buildExercises(): Exercise[] {
  return EXERCISE_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    target_muscle: d.muscle,
    exercise_type: d.type,
    equipment_id: d.equipment,
    fallback_ids: d.fallbacks,
    visual_tag: makeVisualTag(d.type),
  }));
}

// ============================================================
// Routine definition — 6-day Physc Gym split
// Each training day has 3 sets × 10 reps @ 120s rest on every
// exercise (default working set prescription). Sunday is rest.
// ============================================================
type ExerciseBlock = {
  exercise_id: string;
  sets_count: number;
  target_reps_default: number;
  prescribed_rest_seconds: number;
};

type RoutineDay = {
  day_of_week: DayOfWeek;
  label: string;
  exercises: ExerciseBlock[];
};

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const DEFAULT_REST = 120;

function block(
  exercise_id: string
): ExerciseBlock {
  return {
    exercise_id,
    sets_count: DEFAULT_SETS,
    target_reps_default: DEFAULT_REPS,
    prescribed_rest_seconds: DEFAULT_REST,
  };
}

const ROUTINE_DAYS: RoutineDay[] = [
  {
    day_of_week: 1, // Monday
    label: "Legs",
    exercises: [
      block("ex_squat"),
      block("ex_lunges"),
      block("ex_leg_press"),
      block("ex_seated_calf_raise"),
      block("ex_leg_curl"),
      block("ex_leg_extension"),
    ],
  },
  {
    day_of_week: 2, // Tuesday
    label: "Shoulders",
    exercises: [
      block("ex_overhead_press"),
      block("ex_db_lateral_raise"),
      block("ex_db_front_raise"),
      block("ex_rear_delt_fly"),
    ],
  },
  {
    day_of_week: 3, // Wednesday
    label: "Back",
    exercises: [
      block("ex_lat_pulldown_broad"),
      block("ex_lat_pulldown_narrow"),
      block("ex_seated_row"),
      block("ex_tbar_row"),
      block("ex_db_shrugs"),
    ],
  },
  {
    day_of_week: 4, // Thursday
    label: "Biceps",
    exercises: [
      block("ex_ez_curl"),
      block("ex_incline_db_curl"),
      block("ex_preacher_curl"),
      block("ex_reverse_cable_curl"),
    ],
  },
  {
    day_of_week: 5, // Friday
    label: "Chest",
    exercises: [
      block("ex_bench_press"),
      block("ex_db_incline_press"),
      block("ex_decline_press"),
      block("ex_pec_deck_fly"),
      block("ex_db_pullover"),
    ],
  },
  {
    day_of_week: 6, // Saturday
    label: "Triceps",
    exercises: [
      block("ex_tricep_pushdown"),
      block("ex_tricep_dip_machine"),
      block("ex_french_curl"),
      block("ex_tricep_kickback"),
    ],
  },
];

// ---- Build the 7-day scaffold + Physc Gym routine ----
function buildRoutineNodes(
  versionId: string
): { nodes: RoutineNode[]; labels: DayLabel[] } {
  const nodes: RoutineNode[] = [];
  const labels: DayLabel[] = [];
  let seq = 0;

  const routineByDay = new Map<number, RoutineDay>();
  for (const rd of ROUTINE_DAYS) routineByDay.set(rd.day_of_week, rd);

  for (let day = 0; day <= 6; day++) {
    const dow = day as DayOfWeek;
    const routine = routineByDay.get(day);
    const isRestDay = !routine;
    const label = routine?.label ?? "Rest Day";

    // Day label (always present — including "Rest Day" on Sunday)
    labels.push({
      id: uid("lbl"),
      version_id: versionId,
      day_of_week: dow,
      label,
      is_active: true,
    });

    if (isRestDay) {
      // Sunday rest day — no pre/exercise/post blocks
      continue;
    }

    // Fixed pre-workout: dynamic warm-up + joint mobility (8 min)
    nodes.push({
      id: uid("node"),
      version_id: versionId,
      day_of_week: dow,
      block_type: "pre",
      sequence_order: seq++,
      name: "Dynamic Warm-up & Joint Mobility",
      exercise_type: "stretching",
      is_fixed: true,
      duration_minutes: 8,
    });

    // Exercise blocks
    for (const ex of routine.exercises) {
      const def = EXERCISE_MAP[ex.exercise_id];
      if (!def) continue;
      nodes.push({
        id: uid("node"),
        version_id: versionId,
        day_of_week: dow,
        block_type: "exercise",
        sequence_order: seq++,
        exercise_id: def.id,
        name: def.name,
        exercise_type: def.type,
        is_fixed: false,
        sets_count: ex.sets_count,
        target_reps_default: ex.target_reps_default,
        prescribed_rest_seconds: ex.prescribed_rest_seconds,
        sets_override: [],
        fallback_ids: def.fallbacks,
        equipment_source: equipmentSourceFor(def.equipment),
      });
    }

    // Fixed post-workout: steady-state cardio (22 min)
    nodes.push({
      id: uid("node"),
      version_id: versionId,
      day_of_week: dow,
      block_type: "post",
      sequence_order: seq++,
      name: "Steady State Cardio",
      exercise_type: "cardio",
      is_fixed: true,
      duration_minutes: 22,
      intensity_metrics: { incline_gradient: 4.0, speed_kmh: 6.0 },
    });
  }

  return { nodes, labels };
}

// ---- Build user baseline biometrics ----
// Tier 1 (frequently updated): body weight
// Tier 2 (rarely updated): height + body fat %
function buildBiometrics(): Biometric[] {
  const now = new Date().toISOString();
  return [
    {
      id: uid("bio"),
      tier: 2,
      metric: "height",
      value: 168,
      unit: "cm",
      logged_at: now,
    },
    {
      id: uid("bio"),
      tier: 1,
      metric: "body_weight",
      value: 59.3,
      unit: "kg",
      logged_at: now,
    },
    {
      id: uid("bio"),
      tier: 2,
      metric: "body_fat_pct",
      value: 14,
      unit: "%",
      logged_at: now,
    },
  ];
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
    label: "Physc Gym 6-Day Split",
    effective_week: getISOWeek(),
    created_at: now,
    is_active: true,
  };

  const equipment = buildEquipment();
  const exercises = buildExercises();
  const { nodes, labels } = buildRoutineNodes(versionId);
  const biometrics = buildBiometrics();

  await db.transaction(
    "rw",
    [
      db.equipment,
      db.exercises,
      db.routine_versions,
      db.routine_nodes,
      db.day_labels,
      db.biometrics,
    ],
    async () => {
      await db.equipment.bulkPut(equipment);
      await db.exercises.bulkPut(exercises);
      await db.routine_versions.put(version);
      await db.routine_nodes.bulkPut(nodes);
      await db.day_labels.bulkPut(labels);
      await db.biometrics.bulkPut(biometrics);
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
