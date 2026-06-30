// ============================================================
// Vitality Score calculator (testosterone proxy)
// Weighted composite from self-reported markers
// ============================================================

export interface VitalityInput {
  morning_erection: 0 | 1 | 2 | 3; // 0=none, 3=strong
  libido: 1 | 2 | 3 | 4 | 5;
  drive: 1 | 2 | 3 | 4 | 5;
  confidence: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  muscle_fullness: 1 | 2 | 3 | 4 | 5;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
}

// Weights per the formula (Option C)
const WEIGHTS = {
  morning_erection: 2.0,
  libido: 1.5,
  drive: 1.5,
  confidence: 1.0,
  energy: 1.0,
  muscle_fullness: 1.0,
  sleep_quality: 0.5,
};

// Normalize each marker to 0-1 range, then weighted average → 0-100
export function computeVitalityScore(input: VitalityInput): number {
  const normalized = {
    morning_erection: input.morning_erection / 3, // 0-3 → 0-1
    libido: (input.libido - 1) / 4, // 1-5 → 0-1
    drive: (input.drive - 1) / 4,
    confidence: (input.confidence - 1) / 4,
    energy: (input.energy - 1) / 4,
    muscle_fullness: (input.muscle_fullness - 1) / 4,
    sleep_quality: (input.sleep_quality - 1) / 4,
  };

  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const weightedSum =
    normalized.morning_erection * WEIGHTS.morning_erection +
    normalized.libido * WEIGHTS.libido +
    normalized.drive * WEIGHTS.drive +
    normalized.confidence * WEIGHTS.confidence +
    normalized.energy * WEIGHTS.energy +
    normalized.muscle_fullness * WEIGHTS.muscle_fullness +
    normalized.sleep_quality * WEIGHTS.sleep_quality;

  return Math.round((weightedSum / totalWeight) * 100);
}

// Score interpretation
export function getVitalityLabel(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 80) {
    return {
      label: "Peak",
      color: "#10b981", // emerald
      description: "Excellent vitality — T likely optimized",
    };
  } else if (score >= 65) {
    return {
      label: "High",
      color: "#84cc16", // lime
      description: "Strong vitality markers",
    };
  } else if (score >= 45) {
    return {
      label: "Moderate",
      color: "#f59e0b", // amber
      description: "Room for improvement",
    };
  } else if (score >= 25) {
    return {
      label: "Low",
      color: "#f97316", // orange
      description: "Multiple markers suppressed",
    };
  } else {
    return {
      label: "Critical",
      color: "#ef4444", // red
      description: "Consider lifestyle adjustments",
    };
  }
}

// 7-day moving average
export function computeMovingAverage(
  scores: Array<{ date: string; score: number }>,
  window = 7
): Array<{ date: string; score: number; avg: number }> {
  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((point, idx) => {
    const start = Math.max(0, idx - window + 1);
    const windowScores = sorted.slice(start, idx + 1).map((s) => s.score);
    const avg =
      windowScores.reduce((a, b) => a + b, 0) / windowScores.length;
    return { ...point, avg: Math.round(avg) };
  });
}
