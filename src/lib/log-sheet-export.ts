// ============================================================
// Log Sheet Export — generates date-wise workout log templates
// Shows a calendar of dates, greyed out for days with no session
// ============================================================
import { getDB } from "./dexie";
import type { Session, SessionSet, DayOfWeek } from "./types";

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
  startDate: string; // ISO date (YYYY-MM-DD)
  numDays: number; // how many days to generate (7, 14, 30)
}

/**
 * Generate a date-wise workout log sheet.
 * For each date in the range:
 * - If a session exists: fill in the actual data
 * - If no session: show the planned routine for that day with blanks
 * - Rest days: greyed out
 */
export async function generateLogSheet(options: LogSheetOptions): Promise<string> {
  const db = getDB();
  // Parse start date as local date components to avoid timezone issues
  const [sy, sm, sd] = options.startDate.split("-").map(Number);
  const lines: string[] = [];

  // Get active version
  const version =
    (await db.routine_versions
      .where("is_active")
      .equals(1 as never)
      .first()) ??
    (await db.routine_versions.orderBy("created_at").reverse().first());

  if (!version) return "No routine found.";

  // Get all routine nodes + day labels
  const allNodes = await db.routine_nodes
    .where("version_id")
    .equals(version.id)
    .toArray();
  const dayLabels = await db.day_labels
    .where("version_id")
    .equals(version.id)
    .filter((l) => l.is_active)
    .toArray();
  const labelMap = new Map<number, string>();
  for (const l of dayLabels) labelMap.set(l.day_of_week, l.label);

  // Get all completed sessions in the date range
  const allSessions = await db.sessions
    .where("status")
    .equals("completed" as never)
    .toArray();

  for (let i = 0; i < options.numDays; i++) {
    const date = new Date(sy, sm - 1, sd + i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayOfWeek = date.getDay() as DayOfWeek;
    const dayName = DAY_NAMES[dayOfWeek];
    const dayLabel = labelMap.get(dayOfWeek) ?? dayName;

    // Check if there's a completed session for this date
    const session = allSessions.find((s) => s.date === dateStr);

    // Get planned exercises for this day
    const dayNodes = allNodes
      .filter((n) => n.day_of_week === dayOfWeek && n.block_type === "exercise")
      .sort((a, b) => a.sequence_order - b.sequence_order);

    const isRestDay = dayNodes.length === 0;

    // Format date header
    const formattedDate = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (session) {
      // ---- Completed session — fill in actual data ----
      const sets = await db.session_sets
        .where("session_id")
        .equals(session.id)
        .toArray();

      lines.push(`Date: ${formattedDate}`);
      lines.push(`Day: ${dayName} (${session.day_label})`);
      lines.push("");

      // Group sets by exercise
      const byExercise = new Map<string, SessionSet[]>();
      for (const s of sets) {
        if (!byExercise.has(s.exercise_name)) byExercise.set(s.exercise_name, []);
        byExercise.get(s.exercise_name)!.push(s);
      }

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
    } else if (isRestDay) {
      // ---- Rest day — greyed out ----
      lines.push(`Date: ${formattedDate}`);
      lines.push(`Day: ${dayName} (Rest Day)`);
      lines.push("");
      lines.push("[ No training scheduled — rest day ]");
      lines.push("");
      lines.push("Cardio: ___");
      lines.push("Energy: ___/10");
      lines.push("Difficulty: ___/10");
    } else {
      // ---- Planned but not logged — blank template ----
      const preBlock = allNodes.find(
        (n) => n.day_of_week === dayOfWeek && n.block_type === "pre"
      );
      lines.push(`Date: ${formattedDate}`);
      lines.push(`Day: ${dayName} (${dayLabel})`);
      lines.push("");

      if (preBlock) {
        lines.push(`Warm-up: ${preBlock.name} (${preBlock.duration_minutes} min)`);
        lines.push("");
      }

      dayNodes.forEach((ex, idx) => {
        const sets = ex.sets_count ?? 3;
        const reps = ex.target_reps_default ?? 10;
        lines.push(
          `${idx + 1}. ${ex.name} – ___ kg – ${sets} sets × ${reps} reps`
        );
      });

      lines.push("");
      lines.push("Cardio:");
      lines.push("Machine: ___");
      lines.push("Time: ___ min");
      lines.push("Distance/Steps: ___");
      lines.push("");
      lines.push("Energy: ___/10");
      lines.push("Difficulty: ___/10");
    }

    // Separator between days
    if (i < options.numDays - 1) {
      lines.push("");
      lines.push("─".repeat(40));
      lines.push("");
    }
  }

  return lines.join("\n");
}
