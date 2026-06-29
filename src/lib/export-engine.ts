// ============================================================
// Export engine — generates clipboard-ready output
// Channel 1: Post-session Markdown (for external AI food/recovery suggestions)
// Channel 2: Routine JSON backup (full routine export for re-import)
// ============================================================
import type { Session, SessionSet, Biometric, RoutineVersion, RoutineNode, Exercise, Equipment } from "@/lib/types";
import {
  computeTotalVolume,
  estimate1RM,
  bestSet,
} from "./analytics";

interface ExportContext {
  session: Session;
  sets: SessionSet[];
  latestBodyweight: Biometric | null;
  weeklyVolume: number;
}

/**
 * Generate the post-session Markdown payload.
 * Optimized for LLM token efficiency — compact but complete.
 * Includes: session metadata, per-set logs, volume math, bodyweight context.
 */
export function generateSessionMarkdown(ctx: ExportContext): string {
  const { session, sets, latestBodyweight, weeklyVolume } = ctx;
  const totalVolume = computeTotalVolume(sets);
  const best = bestSet(sets);
  const best1RM = best ? estimate1RM(best.weight_kg, best.reps_completed) : 0;

  // Group sets by exercise
  const byExercise = new Map<string, SessionSet[]>();
  for (const s of sets) {
    const key = s.exercise_name;
    if (!byExercise.has(key)) byExercise.set(key, []);
    byExercise.get(key)!.push(s);
  }

  const lines: string[] = [
    `### WORKOUT LOG — DATE: ${session.date}`,
    `**Routine:** ${session.day_label}`,
    `**Duration:** ${session.ended_at ? formatDuration(session.started_at, session.ended_at) : "in progress"}`,
    `**Total Volume:** ${totalVolume.toLocaleString()} kg`,
    `**Best Set 1RM (Epley):** ${best1RM.toFixed(1)} kg`,
    `**Sets Logged:** ${sets.length}`,
    latestBodyweight
      ? `**Body Weight:** ${latestBodyweight.value} ${latestBodyweight.unit} (logged ${formatDaysAgo(latestBodyweight.logged_at)})`
      : `**Body Weight:** not recorded`,
    `**Weekly Volume (rolling):** ${weeklyVolume.toLocaleString()} kg`,
    "",
    "| Exercise | Set | Weight (kg) | Reps | Type |",
    "| :--- | :---: | :---: | :---: | :--- |",
  ];

  for (const [exerciseName, exSets] of byExercise) {
    exSets
      .sort((a, b) => a.set_index - b.set_index)
      .forEach((s) => {
        const status = s.is_fallback ? "FALLBACK_SUB" : "PRIMARY";
        lines.push(
          `| ${exerciseName} | ${s.set_index} | ${s.weight_kg} | ${s.reps_completed} | ${status} |`
        );
      });
  }

  lines.push(
    "",
    "**Cardio & Recovery:**",
    `- Pre-workout stretch: included in session plan`,
    `- Post-workout cardio: included in session plan`,
    "",
    "[SYSTEM INSTRUCTION FOR EXTERNAL AI: Based on the localized exertion data above, compute target caloric expenditure, recovery parameters, and nutritional profiles (macros, hydration, timing) matching this training session. Do not suggest generic advice — use the actual volume and 1RM data provided.]"
  );

  return lines.join("\n");
}

/**
 * Generate a full routine JSON backup.
 * Includes: version, nodes, exercises, equipment, day labels.
 * Can be re-imported via the AI gateway.
 */
export interface RoutineBackup {
  export_version: string;
  exported_at: string;
  routine: {
    version: RoutineVersion;
    nodes: RoutineNode[];
    day_labels: Array<{
      day_of_week: number;
      label: string;
      is_active: boolean;
    }>;
  };
  exercises: Exercise[];
  equipment: Equipment[];
}

export function generateRoutineBackup(
  version: RoutineVersion,
  nodes: RoutineNode[],
  dayLabels: Array<{ day_of_week: number; label: string; is_active: boolean }>,
  exercises: Exercise[],
  equipment: Equipment[]
): RoutineBackup {
  return {
    export_version: "1.0",
    exported_at: new Date().toISOString(),
    routine: {
      version,
      nodes,
      day_labels: dayLabels,
    },
    exercises,
    equipment,
  };
}

export function routineBackupToJson(backup: RoutineBackup): string {
  return JSON.stringify(backup, null, 2);
}

// ---- Helpers ----
function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatDaysAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
