// ============================================================
// Calorie estimation — METs × bodyweight × duration
// Rough but useful for AI nutrition context
// ============================================================
import type { SessionSet, Biometric } from "./types";

// MET values per exercise type (metabolic equivalent)
const METS_BY_TYPE: Record<string, number> = {
  // Compound barbell (high intensity)
  bench_press: 6.0,
  squat: 7.0,
  deadlift: 7.0,
  row: 6.5,
  press: 6.0,
  // Machine exercises
  machine: 5.0,
  // Isolation / dumbbell
  isolation: 4.0,
  dumbbell: 4.5,
  // Cardio
  cardio: 7.0,
  // Stretching
  stretching: 2.5,
};

function estimateExerciseMET(exerciseName: string, exerciseType: string): number {
  const name = exerciseName.toLowerCase();
  // Check for compound keywords
  if (name.includes("squat") || name.includes("deadlift")) return METS_BY_TYPE.squat;
  if (name.includes("bench") || name.includes("press")) return METS_BY_TYPE.bench_press;
  if (name.includes("row") || name.includes("pull")) return METS_BY_TYPE.row;
  // Fall back to type-based
  if (exerciseType === "cardio") return METS_BY_TYPE.cardio;
  if (exerciseType === "stretching") return METS_BY_TYPE.stretching;
  if (exerciseType === "machine") return METS_BY_TYPE.machine;
  return METS_BY_TYPE.dumbbell;
}

/**
 * Estimate calories burned during a session.
 * Formula: METs × bodyweight(kg) × duration(hours)
 * Per-set: METs × bodyweight × (set_time + rest_time) / 3600
 * Assumes ~45s per set + average rest
 */
export function estimateCaloriesBurned(
  sets: SessionSet[],
  bodyweight: number | null,
  avgRestSeconds: number = 120
): number {
  if (sets.length === 0 || !bodyweight) return 0;

  let totalCalories = 0;
  const setDurationSeconds = 45; // avg time under tension per set

  for (const set of sets) {
    const met = estimateExerciseMET(set.exercise_name, "");
    const totalSetTimeSeconds = setDurationSeconds + avgRestSeconds;
    const hours = totalSetTimeSeconds / 3600;
    totalCalories += met * bodyweight * hours;
  }

  return Math.round(totalCalories);
}

/**
 * Get the MET value for an exercise (for display)
 */
export function getExerciseMET(exerciseName: string, exerciseType: string): number {
  return estimateExerciseMET(exerciseName, exerciseType);
}
