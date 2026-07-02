// ============================================================
// Database seeder — populates Dexie on first run
// Seeds:
//   • Equipment (built from inventory.json)
//   • Full Physc Gym exercise catalog (45 exercises across
//     8 categories: legs, calves, back, biceps, chest,
//     shoulders, triceps, cardio, core)
//   • 6-day training split:
//       Mon=Legs, Tue=Shoulders, Wed=Back, Thu=Biceps,
//       Fri=Chest, Sat=Triceps+Core, Sun=Rest Day
//   • Fixed daily blocks on every training day:
//       Pre:  "Joint Mobility & Dynamic Warm-up" (10 min, stretching)
//       Post: "Cardio + Static Stretching" (25 min, cardio)
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
// - mach_* / treadmill_* / elliptical_* / exercise_bike_* / stairmaster_* → machine
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
  // mach_*, treadmill_*, elliptical_*, exercise_bike_*, stairmaster_*
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
// Exercise catalog — full Physc Gym master list (45 entries)
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
  // ---- Legs (8) ----
  {
    id: "ex_squats",
    name: "Squats",
    muscle: "legs",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_leg_press"],
  },
  {
    id: "ex_lunges",
    name: "Lunges",
    muscle: "legs",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_step_up"],
  },
  {
    id: "ex_step_up",
    name: "Step Up",
    muscle: "legs",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_lunges"],
  },
  {
    id: "ex_leg_press",
    name: "Leg Press",
    muscle: "legs",
    type: "machine",
    equipment: "mach_leg_press_01",
    fallbacks: ["ex_squats"],
  },
  {
    id: "ex_leg_curl",
    name: "Leg Curl",
    muscle: "legs",
    type: "machine",
    equipment: "mach_leg_curl_01",
    fallbacks: ["ex_stiff_leg_deadlift"],
  },
  {
    id: "ex_straight_leg_calf_raises",
    name: "Straight Leg Calf Raises",
    muscle: "calves",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_seated_calf_raises"],
  },
  {
    id: "ex_seated_calf_raises",
    name: "Seated Calf Raises",
    muscle: "calves",
    type: "machine",
    equipment: "mach_calf_raise_01",
    fallbacks: ["ex_straight_leg_calf_raises"],
  },
  {
    id: "ex_leg_extension",
    name: "Leg Extension",
    muscle: "legs",
    type: "machine",
    equipment: "mach_leg_extension_01",
    fallbacks: ["ex_squats"],
  },

  // ---- Back (10) ----
  {
    id: "ex_seated_rows",
    name: "Seated Rows",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_tbar_row", "ex_one_arm_rows"],
  },
  {
    id: "ex_bent_over_rows",
    name: "Bent Over Rows",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_tbar_row", "ex_seated_rows"],
  },
  {
    id: "ex_one_arm_rows",
    name: "One Arm Rows",
    muscle: "back",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_bent_over_rows", "ex_seated_rows"],
  },
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
    id: "ex_db_shrugs",
    name: "Dumbbell Shrugs",
    muscle: "back",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: [],
  },
  {
    id: "ex_deadlift",
    name: "Deadlift",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_stiff_leg_deadlift"],
  },
  {
    id: "ex_stiff_leg_deadlift",
    name: "Stiff Leg Deadlift",
    muscle: "back",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_deadlift", "ex_leg_curl"],
  },
  {
    id: "ex_tbar_row",
    name: "T-Bar Row",
    muscle: "back",
    type: "machine",
    equipment: "mach_tbar_01",
    fallbacks: ["ex_bent_over_rows", "ex_seated_rows"],
  },
  {
    id: "ex_back_extension",
    name: "Superman / Back Extension",
    muscle: "back",
    type: "non-machine",
    equipment: "mach_back_extension_01",
    fallbacks: [],
  },

  // ---- Biceps (4) ----
  {
    id: "ex_biceps_curl",
    name: "Biceps Curl",
    muscle: "biceps",
    type: "non-machine",
    equipment: "bar_ez_10",
    fallbacks: ["ex_incline_db_curl", "ex_preacher_curl"],
  },
  {
    id: "ex_incline_db_curl",
    name: "Incline Dumbbell Curl",
    muscle: "biceps",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_biceps_curl"],
  },
  {
    id: "ex_reverse_cable_curl",
    name: "Reverse Cable Curl",
    muscle: "biceps",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: ["ex_biceps_curl"],
  },
  {
    id: "ex_preacher_curl",
    name: "Preacher Curl",
    muscle: "biceps",
    type: "machine",
    equipment: "mach_bicep_curl_01",
    fallbacks: ["ex_biceps_curl"],
  },

  // ---- Chest (5) ----
  {
    id: "ex_decline_chest_press",
    name: "Decline Chest Press",
    muscle: "chest",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_flat_chest_press"],
  },
  {
    id: "ex_incline_chest_press",
    name: "Incline Chest Press",
    muscle: "chest",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_flat_chest_press"],
  },
  {
    id: "ex_pec_fly",
    name: "Pec Fly / Cable Crossover",
    muscle: "chest",
    type: "machine",
    equipment: "mach_pec_deck_01",
    fallbacks: ["ex_db_pullover"],
  },
  {
    id: "ex_db_pullover",
    name: "Dumbbell Pullover",
    muscle: "chest",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_pec_fly"],
  },
  {
    id: "ex_flat_chest_press",
    name: "Flat Chest Press",
    muscle: "chest",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_incline_chest_press", "ex_decline_chest_press"],
  },

  // ---- Shoulders (5) ----
  {
    id: "ex_overhead_press",
    name: "Overhead Press",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "bar_std_20",
    fallbacks: ["ex_upright_row"],
  },
  {
    id: "ex_lateral_raises",
    name: "Lateral Raises",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_upright_row"],
  },
  {
    id: "ex_front_raises",
    name: "Front Raises",
    muscle: "shoulders",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_overhead_press"],
  },
  {
    id: "ex_upright_row",
    name: "Upright Row",
    muscle: "shoulders",
    type: "machine",
    equipment: "mach_upright_row_01",
    fallbacks: ["ex_lateral_raises"],
  },
  {
    id: "ex_rear_delt_fly",
    name: "Rear Delt Fly / Prone High Rows",
    muscle: "shoulders",
    type: "machine",
    equipment: "mach_cable_crossover_01",
    fallbacks: [],
  },

  // ---- Triceps (6) ----
  {
    id: "ex_tricep_pushdown",
    name: "Triceps Pushdown",
    muscle: "triceps",
    type: "machine",
    equipment: "mach_tricep_pushdown_01",
    fallbacks: ["ex_tricep_machine", "ex_french_curl"],
  },
  {
    id: "ex_tricep_dip_machine",
    name: "Triceps Dip Machine",
    muscle: "triceps",
    type: "machine",
    equipment: "mach_tricep_dip_01",
    fallbacks: ["ex_tricep_pushdown", "ex_close_grip_pushups"],
  },
  {
    id: "ex_tricep_machine",
    name: "Triceps Machine",
    muscle: "triceps",
    type: "machine",
    equipment: "mach_tricep_01",
    fallbacks: ["ex_tricep_pushdown"],
  },
  {
    id: "ex_tricep_kickback",
    name: "Triceps Kickback",
    muscle: "triceps",
    type: "non-machine",
    equipment: "dumbbell_set_01",
    fallbacks: ["ex_french_curl"],
  },
  {
    id: "ex_french_curl",
    name: "French Curl / Skull Crusher",
    muscle: "triceps",
    type: "non-machine",
    equipment: "bar_ez_10",
    fallbacks: ["ex_tricep_pushdown", "ex_tricep_kickback"],
  },
  {
    id: "ex_close_grip_pushups",
    name: "Close Grip Push-ups",
    muscle: "triceps",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: ["ex_tricep_dip_machine", "ex_french_curl"],
  },

  // ---- Cardio (1) ----
  {
    id: "ex_cardio_general",
    name: "Cardio (Treadmill / Elliptical / Bike)",
    muscle: "cardio",
    type: "cardio",
    equipment: "treadmill_01",
    fallbacks: [],
  },

  // ---- Core / Abs (6) ----
  {
    id: "ex_situps",
    name: "Sit-ups",
    muscle: "core",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: ["ex_crunches"],
  },
  {
    id: "ex_crunches",
    name: "Crunches on Floor",
    muscle: "core",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: ["ex_situps"],
  },
  {
    id: "ex_twisting_crunches",
    name: "Twisting Crunches on Floor",
    muscle: "core",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: ["ex_crunches"],
  },
  {
    id: "ex_leg_flexion",
    name: "Leg Flexion / Leg Raises",
    muscle: "core",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: ["ex_reverse_crunches"],
  },
  {
    id: "ex_plank",
    name: "Plank on Floor",
    muscle: "core",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: [],
  },
  {
    id: "ex_reverse_crunches",
    name: "Reverse Crunches on Incline / Hanging",
    muscle: "core",
    type: "non-machine",
    equipment: "none_bodyweight",
    fallbacks: ["ex_crunches", "ex_leg_flexion"],
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

function block(exercise_id: string): ExerciseBlock {
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
      block("ex_squats"),
      block("ex_lunges"),
      block("ex_leg_press"),
      block("ex_seated_calf_raises"),
      block("ex_leg_curl"),
      block("ex_leg_extension"),
    ],
  },
  {
    day_of_week: 2, // Tuesday
    label: "Shoulders",
    exercises: [
      block("ex_overhead_press"),
      block("ex_lateral_raises"),
      block("ex_front_raises"),
      block("ex_rear_delt_fly"),
    ],
  },
  {
    day_of_week: 3, // Wednesday
    label: "Back",
    exercises: [
      block("ex_lat_pulldown_broad"),
      block("ex_lat_pulldown_narrow"),
      block("ex_seated_rows"),
      block("ex_tbar_row"),
      block("ex_db_shrugs"),
    ],
  },
  {
    day_of_week: 4, // Thursday
    label: "Biceps",
    exercises: [
      block("ex_biceps_curl"),
      block("ex_incline_db_curl"),
      block("ex_preacher_curl"),
      block("ex_reverse_cable_curl"),
    ],
  },
  {
    day_of_week: 5, // Friday
    label: "Chest",
    exercises: [
      block("ex_flat_chest_press"),
      block("ex_incline_chest_press"),
      block("ex_decline_chest_press"),
      block("ex_pec_fly"),
      block("ex_db_pullover"),
    ],
  },
  {
    day_of_week: 6, // Saturday
    label: "Triceps + Core",
    exercises: [
      block("ex_tricep_pushdown"),
      block("ex_tricep_dip_machine"),
      block("ex_french_curl"),
      block("ex_tricep_kickback"),
      block("ex_plank"),
      block("ex_crunches"),
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

    // Fixed pre-workout: joint mobility + dynamic warm-up (10 min)
    nodes.push({
      id: uid("node"),
      version_id: versionId,
      day_of_week: dow,
      block_type: "pre",
      sequence_order: seq++,
      name: "Joint Mobility & Dynamic Warm-up",
      exercise_type: "stretching",
      is_fixed: true,
      duration_minutes: 10,
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

    // Fixed post-workout: cardio + static stretching (25 min)
    nodes.push({
      id: uid("node"),
      version_id: versionId,
      day_of_week: dow,
      block_type: "post",
      sequence_order: seq++,
      name: "Cardio + Static Stretching",
      exercise_type: "cardio",
      is_fixed: true,
      duration_minutes: 25,
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
