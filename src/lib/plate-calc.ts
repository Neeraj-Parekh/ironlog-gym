// ============================================================
// Plate-loading greedy calculator
// Computes exact plate combination per side from inventory.
// Shows remainder warning + nearest achievable target.
// ============================================================
import type { Equipment } from "@/lib/types";

export interface PlateLoadingResult {
  per_side: Array<{ weight: number; count: number }>;
  total_loaded_kg: number;
  remainder_kg: number;
  achievable: boolean;
  nearest_lower_kg: number | null;
  nearest_higher_kg: number | null;
  message: string;
}

/**
 * Greedy plate allocation per side.
 * target = bar_weight + 2 * (sum of plates per side)
 */
export function calculatePlateLoading(
  targetWeight: number,
  barWeight: number,
  platesAvailable: Record<string, number> // kg -> pair count
): PlateLoadingResult {
  if (targetWeight <= barWeight) {
    return {
      per_side: [],
      total_loaded_kg: barWeight,
      remainder_kg: 0,
      achievable: targetWeight === barWeight,
      nearest_lower_kg: null,
      nearest_higher_kg: null,
      message:
        targetWeight === barWeight
          ? "Just the empty bar."
          : "Target is below bar weight.",
    };
  }

  const targetSideWeight = (targetWeight - barWeight) / 2;
  const manifest: Array<{ weight: number; count: number }> = [];
  let remaining = targetSideWeight;

  // Build a normalized plate map: number -> pair count
  // (inventory keys may be "20.0" or "20" — normalize via Number)
  const normalizedPlates: Array<{ weight: number; pairs: number }> = [];
  for (const [key, count] of Object.entries(platesAvailable)) {
    const w = Number(key);
    if (!isNaN(w) && count > 0) {
      normalizedPlates.push({ weight: w, pairs: count });
    }
  }
  normalizedPlates.sort((a, b) => b.weight - a.weight);

  for (const { weight: plateWeight, pairs: pairsAvailable } of normalizedPlates) {
    if (remaining <= 0) break;
    if (pairsAvailable <= 0) continue;

    const needed = Math.floor(remaining / plateWeight);
    const actual = Math.min(needed, pairsAvailable);

    if (actual > 0) {
      manifest.push({ weight: plateWeight, count: actual });
      remaining -= actual * plateWeight;
    }
  }

  const totalLoaded = barWeight + manifest.reduce(
    (sum, p) => sum + p.weight * p.count * 2,
    0
  );
  const remainder = targetWeight - totalLoaded;
  const achievable = Math.abs(remainder) < 0.01;

  // Find nearest achievable targets
  const achievableWeights = computeAchievableWeights(barWeight, platesAvailable);
  let nearestLower: number | null = null;
  let nearestHigher: number | null = null;
  for (const w of achievableWeights) {
    if (w <= targetWeight && (nearestLower === null || w > nearestLower)) {
      nearestLower = w;
    }
    if (w >= targetWeight && (nearestHigher === null || w < nearestHigher)) {
      nearestHigher = w;
    }
  }
  // Clean up duplicates / off-by-epsilon
  if (nearestLower !== null && Math.abs(nearestLower - targetWeight) < 0.01) {
    nearestLower = null;
  }
  if (nearestHigher !== null && Math.abs(nearestHigher - targetWeight) < 0.01) {
    nearestHigher = null;
  }

  let message: string;
  if (achievable) {
    message = `Load ${formatPerSide(manifest)} per side.`;
  } else {
    const parts: string[] = [
      `Can't hit exactly ${targetWeight}kg. Loaded ${totalLoaded}kg.`,
    ];
    if (nearestLower !== null && nearestLower < totalLoaded) {
      parts.push(`Nearest lower: ${nearestLower}kg`);
    }
    if (nearestHigher !== null) {
      parts.push(`Nearest higher: ${nearestHigher}kg`);
    }
    message = parts.join(" ");
  }

  return {
    per_side: manifest,
    total_loaded_kg: totalLoaded,
    remainder_kg: remainder,
    achievable,
    nearest_lower_kg: nearestLower,
    nearest_higher_kg: nearestHigher,
    message,
  };
}

function computeAchievableWeights(
  barWeight: number,
  platesAvailable: Record<string, number>
): number[] {
  // Generate a reasonable set of achievable weights up to ~300kg
  const weights: number[] = [];
  const plates = Object.keys(platesAvailable)
    .map(Number)
    .sort((a, b) => b - a);
  // Simple: try increments of the smallest plate
  const smallest = Math.min(...plates);
  const step = smallest * 2; // per-side pair = 2x smallest
  for (let w = barWeight; w <= 300; w += step) {
    // Verify this weight is achievable
    const side = (w - barWeight) / 2;
    const result = greedyAllocate(side, platesAvailable);
    const loaded = barWeight + result.reduce((s, p) => s + p.weight * p.count * 2, 0);
    if (Math.abs(loaded - w) < 0.01) {
      weights.push(w);
    }
  }
  return weights;
}

function greedyAllocate(
  sideWeight: number,
  platesAvailable: Record<string, number>
): Array<{ weight: number; count: number }> {
  const manifest: Array<{ weight: number; count: number }> = [];
  let remaining = sideWeight;
  const normalized: Array<{ weight: number; pairs: number }> = [];
  for (const [key, count] of Object.entries(platesAvailable)) {
    const w = Number(key);
    if (!isNaN(w) && count > 0) normalized.push({ weight: w, pairs: count });
  }
  normalized.sort((a, b) => b.weight - a.weight);
  for (const { weight: plateWeight, pairs: pairsAvailable } of normalized) {
    if (remaining <= 0) break;
    const needed = Math.floor(remaining / plateWeight);
    const actual = Math.min(needed, pairsAvailable);
    if (actual > 0) {
      manifest.push({ weight: plateWeight, count: actual });
      remaining -= actual * plateWeight;
    }
  }
  return manifest;
}

function formatPerSide(manifest: Array<{ weight: number; count: number }>): string {
  return manifest.map((p) => `${p.count}×${p.weight}kg`).join(" + ");
}

/**
 * Resolve equipment for a barbell exercise.
 * If preferredBarId is provided, uses that specific barbell.
 * Otherwise defaults to the heaviest standard Olympic bar (20kg).
 */
export function resolveBarbellEquipment(
  equipment: Equipment[],
  preferredBarId?: string
): { barWeight: number; plates: Record<string, number> } | null {
  const barbells = equipment.filter(
    (e): e is Extract<Equipment, { kind: "barbell" }> => e.kind === "barbell"
  );
  if (barbells.length === 0) return null;

  // Try preferred bar first, then fall back to 20kg Olympic, then heaviest
  let barbell = preferredBarId
    ? barbells.find((b) => b.id === preferredBarId)
    : undefined;
  if (!barbell) {
    barbell = barbells.find((b) => b.weight_kg === 20) ?? barbells[0];
  }

  const plateSet = equipment.find(
    (e): e is Extract<Equipment, { kind: "plate" }> => e.kind === "plate"
  );
  const plates = plateSet ? plateSet.pairs_available : {};
  return { barWeight: barbell.weight_kg, plates };
}
