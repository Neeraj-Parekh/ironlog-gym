// ============================================================
// Analytics math — volume, estimated 1RM, progressive overload velocity
// All formulas are standard sports-science equations.
// ============================================================
import type { Session, SessionSet } from "@/lib/types";

// ---- Total volume for a session ----
export function computeTotalVolume(sets: SessionSet[]): number {
  return sets.reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0);
}

// ---- Estimated 1RM via Epley formula ----
// 1RM = w × (1 + reps/30)
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// ---- Best set (highest 1RM) from a list of sets ----
export function bestSet(sets: SessionSet[]): SessionSet | null {
  if (sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const best1RM = estimate1RM(best.weight_kg, best.reps_completed);
    const s1RM = estimate1RM(s.weight_kg, s.reps_completed);
    return s1RM > best1RM ? s : best;
  }, sets[0]);
}

// ---- Progressive Overload Velocity (Gv) ----
// Compares the average 1RM of the last `windowSize` sessions
// vs the average of the prior `windowSize` sessions.
// Gv > 0: growth, Gv ≈ 0: plateau, Gv < 0: regression
export interface ProgressiveOverloadResult {
  velocity: number; // percentage change
  status: "growth" | "plateau" | "regression";
  recent1RM: number;
  prior1RM: number;
}

export function computeProgressiveOverload(
  session1RMs: number[], // ordered oldest → newest
  windowSize = 3
): ProgressiveOverloadResult | null {
  if (session1RMs.length < windowSize * 2) return null;

  const recent = session1RMs.slice(-windowSize);
  const prior = session1RMs.slice(-windowSize * 2, -windowSize);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;

  if (priorAvg === 0) {
    return {
      velocity: 0,
      status: "plateau",
      recent1RM: recentAvg,
      prior1RM: priorAvg,
    };
  }

  const velocity = ((recentAvg - priorAvg) / priorAvg) * 100;
  const status =
    Math.abs(velocity) < 2
      ? "plateau"
      : velocity > 0
      ? "growth"
      : "regression";

  return {
    velocity,
    status,
    recent1RM: recentAvg,
    prior1RM: priorAvg,
  };
}

// ---- Session summary ----
export interface SessionSummary {
  session: Session;
  totalVolume: number;
  totalSets: number;
  best1RM: number;
  durationMinutes: number | null;
}

export function summarizeSession(
  session: Session,
  sets: SessionSet[]
): SessionSummary {
  const volume = computeTotalVolume(sets);
  const best = bestSet(sets);
  const best1RM = best
    ? estimate1RM(best.weight_kg, best.reps_completed)
    : 0;

  let durationMinutes: number | null = null;
  if (session.ended_at) {
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    durationMinutes = Math.round((end - start) / 60000);
  }

  return {
    session,
    totalVolume: volume,
    totalSets: sets.length,
    best1RM,
    durationMinutes,
  };
}

// ---- Group sets by exercise for per-exercise trends ----
export interface ExerciseTrendPoint {
  date: string;
  sessionId: string;
  volume: number;
  best1RM: number;
  bestWeight: number;
  bestReps: number;
}

export function buildExerciseTrend(
  exerciseId: string,
  sessions: Array<{ session: Session; sets: SessionSet[] }>
): ExerciseTrendPoint[] {
  const points: ExerciseTrendPoint[] = [];

  for (const { session, sets } of sessions) {
    const exSets = sets.filter((s) => s.exercise_id === exerciseId);
    if (exSets.length === 0) continue;

    const best = bestSet(exSets);
    points.push({
      date: session.date,
      sessionId: session.id,
      volume: computeTotalVolume(exSets),
      best1RM: best ? estimate1RM(best.weight_kg, best.reps_completed) : 0,
      bestWeight: best?.weight_kg ?? 0,
      bestReps: best?.reps_completed ?? 0,
    });
  }

  // Sort oldest → newest
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
