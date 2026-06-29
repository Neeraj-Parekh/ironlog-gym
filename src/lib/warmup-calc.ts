// ============================================================
// Warm-up set calculator
// Generates ramp-up sets based on working weight
// ============================================================

export interface WarmupSet {
  set_number: number;
  weight_kg: number;
  reps: number;
  percentage: number;
  label: string;
}

/**
 * Standard warm-up ramp:
 * - Empty bar × 10 (50% for a 40kg working weight)
 * - 60% × 5
 * - 75% × 3
 * - 85% × 1
 * - 90% × 1 (optional, for heavier loads)
 */
export function calculateWarmupSets(
  workingWeightKg: number,
  barWeightKg = 20
): WarmupSet[] {
  if (workingWeightKg <= barWeightKg) return [];

  const sets: WarmupSet[] = [];

  // Empty bar for warmup
  sets.push({
    set_number: 1,
    weight_kg: barWeightKg,
    reps: 10,
    percentage: Math.round((barWeightKg / workingWeightKg) * 100),
    label: "Empty bar",
  });

  // 60% × 5
  const w60 = roundToPlates(workingWeightKg * 0.6, barWeightKg);
  if (w60 > barWeightKg) {
    sets.push({
      set_number: 2,
      weight_kg: w60,
      reps: 5,
      percentage: 60,
      label: "Light",
    });
  }

  // 75% × 3
  const w75 = roundToPlates(workingWeightKg * 0.75, barWeightKg);
  if (w75 > w60) {
    sets.push({
      set_number: 3,
      weight_kg: w75,
      reps: 3,
      percentage: 75,
      label: "Moderate",
    });
  }

  // 85% × 1
  const w85 = roundToPlates(workingWeightKg * 0.85, barWeightKg);
  if (w85 > w75) {
    sets.push({
      set_number: 4,
      weight_kg: w85,
      reps: 1,
      percentage: 85,
      label: "Heavy single",
    });
  }

  // 90% × 1 (only for heavy working weights)
  if (workingWeightKg >= 100) {
    const w90 = roundToPlates(workingWeightKg * 0.9, barWeightKg);
    if (w90 > w85) {
      sets.push({
        set_number: 5,
        weight_kg: w90,
        reps: 1,
        percentage: 90,
        label: "Opener prep",
      });
    }
  }

  return sets;
}

function roundToPlates(weight: number, barWeight: number): number {
  // Round to nearest 2.5kg (standard plate increment)
  const sideWeight = (weight - barWeight) / 2;
  const roundedSide = Math.round(sideWeight / 2.5) * 2.5;
  return barWeight + roundedSide * 2;
}
