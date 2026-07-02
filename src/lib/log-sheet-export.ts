// ============================================================
// Log Sheet Export — generates printable/fillable workout log templates
// Format: blank template with exercise list + cardio + energy/difficulty
// ============================================================
import { getDB } from "./dexie";
import type { RoutineNode, DayOfWeek } from "./types";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface LogSheetOptions {
  days: DayOfWeek[]; // which days to include
  weekLabel?: string; // optional week label
  startDate?: string; // ISO date for the first day
}

/**
 * Generate a blank workout log sheet for selected days.
 * Format per the user's spec:
 *
 * Date: 2 July 2026
 * Day: Monday (Legs)
 *
 * 1. Squats – ___ kg – ___ sets × ___ reps
 * 2. Lunges – ___ kg – ___ sets × ___ reps
 * ...
 *
 * Cardio:
 * Machine: ___
 * Time: ___
 * Distance/Steps: ___
 *
 * Energy: __/10
 * Difficulty: __/10
 */
export async function generateLogSheet(options: LogSheetOptions): Promise<string> {
  const db = getDB();

  // Get active version
  const version =
    (await db.routine_versions
      .where("is_active")
      .equals(1 as never)
      .first()) ??
    (await db.routine_versions.orderBy("created_at").reverse().first());

  if (!version) return "No routine found.";

  // Get all nodes
  const allNodes = await db.routine_nodes
    .where("version_id")
    .equals(version.id)
    .toArray();

  // Get day labels
  const dayLabels = await db.day_labels
    .where("version_id")
    .equals(version.id)
    .filter((l) => l.is_active)
    .toArray();

  const labelMap = new Map<number, string>();
  for (const l of dayLabels) {
    labelMap.set(l.day_of_week, l.label);
  }

  const lines: string[] = [];
  const startDate = options.startDate ? new Date(options.startDate) : new Date();

  for (const day of options.days) {
    // Calculate date for this day
    const dayDate = new Date(startDate);
    const currentDay = startDate.getDay();
    const diff = (day - currentDay + 7) % 7;
    dayDate.setDate(dayDate.getDate() + diff);

    const dateStr = dayDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const dayName = DAY_NAMES[day];
    const dayLabel = labelMap.get(day) ?? dayName;

    lines.push(`Date: ${dateStr}`);
    lines.push(`Day: ${dayName} (${dayLabel})`);
    lines.push("");

    // Get exercise nodes for this day
    const dayNodes = allNodes
      .filter((n) => n.day_of_week === day)
      .sort((a, b) => {
        const order = { pre: 0, exercise: 1, post: 2 };
        if (a.block_type !== b.block_type)
          return order[a.block_type] - order[b.block_type];
        return a.sequence_order - b.sequence_order;
      });

    const exercises = dayNodes.filter((n) => n.block_type === "exercise");
    const preBlock = dayNodes.find((n) => n.block_type === "pre");
    const postBlock = dayNodes.find((n) => n.block_type === "post");

    // Pre-workout note
    if (preBlock) {
      lines.push(`Warm-up: ${preBlock.name} (${preBlock.duration_minutes} min)`);
      lines.push("");
    }

    // Exercises with blanks
    if (exercises.length > 0) {
      exercises.forEach((ex, i) => {
        const sets = ex.sets_count ?? 3;
        const reps = ex.target_reps_default ?? 10;
        lines.push(
          `${i + 1}. ${ex.name} – ___ kg – ${sets} sets × ${reps} reps`
        );
      });
      lines.push("");
    } else {
      lines.push("Rest day — no exercises prescribed.");
      lines.push("");
    }

    // Cardio section
    lines.push("Cardio:");
    lines.push(`Machine: ___`);
    lines.push(`Time: ___ min`);
    lines.push(`Distance/Steps: ___`);
    lines.push("");

    // Energy and Difficulty
    lines.push(`Energy: ___/10`);
    lines.push(`Difficulty: ___/10`);

    // Separator between days
    if (options.days.indexOf(day) < options.days.length - 1) {
      lines.push("");
      lines.push("─".repeat(40));
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Generate log sheet for a single completed session
 * (fills in the blanks with actual logged data)
 */
export async function generateCompletedLogSheet(sessionId: string): Promise<string> {
  const db = getDB();
  const session = await db.sessions.get(sessionId);
  if (!session) return "Session not found.";

  const sets = await db.session_sets
    .where("session_id")
    .equals(sessionId)
    .toArray();

  // Group by exercise
  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    if (!byExercise.has(s.exercise_name)) byExercise.set(s.exercise_name, []);
    byExercise.get(s.exercise_name)!.push(s);
  }

  const date = new Date(session.started_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dayName = DAY_NAMES[session.day_of_week];

  const lines: string[] = [
    `Date: ${date}`,
    `Day: ${dayName} (${session.day_label})`,
    "",
  ];

  // Exercises with filled data
  let idx = 1;
  for (const [exerciseName, exSets] of byExercise) {
    const bestSet = exSets.reduce((best, s) => {
      const bVol = best.weight_kg * best.reps_completed;
      const sVol = s.weight_kg * s.reps_completed;
      return sVol > bVol ? s : best;
    }, exSets[0]);
    lines.push(
      `${idx}. ${exerciseName} – ${bestSet.weight_kg} kg – ${exSets.length} sets × ${bestSet.reps_completed} reps`
    );
    idx++;
  }

  lines.push("");
  lines.push("Cardio:");
  lines.push(`Machine: ${session.cardio_machine ?? "___"}`);
  lines.push(`Time: ${session.cardio_duration_min ?? "___"} min`);
  lines.push(`Distance/Steps: ${session.cardio_distance ?? "___"}`);
  lines.push("");
  lines.push(`Energy: ${session.energy_rating ?? "_"}/10`);
  lines.push(`Difficulty: ${session.difficulty_rating ?? "_"}/10`);

  if (session.notes) {
    lines.push("");
    lines.push(`Notes: ${session.notes}`);
  }

  return lines.join("\n");
}
