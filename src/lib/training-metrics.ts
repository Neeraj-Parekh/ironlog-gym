// ============================================================
// Advanced training metrics — research-backed formulas
// ============================================================
import type { SessionSet, Session, Biometric } from "./types";
import { getWeekStart, getWeekStartNWeeksAgo, getWeekEndNWeeksAgo, isInCurrentWeek, isInWeek } from "./calendar-weeks";

// ---- 1. Acute:Chronic Workload Ratio (ACWR) ----
// Gabbett (2016) — injury risk indicator
// ACWR = 1-week total load / 4-week average weekly load
// Sweet spot: 0.8–1.3 | High risk: >1.5 | Undertrained: <0.8
export interface ACWRResult {
  ratio: number;
  acuteLoad: number; // 1-week total
  chronicLoad: number; // 4-week average
  zone: "safe" | "caution" | "high_risk" | "undertrained";
  message: string;
}

export function computeACWR(
  sessions: Array<{ session: Session; sets: SessionSet[] }>,
  weeksBack: number = 0
): ACWRResult | null {
  // Acute load = volume in current calendar week (Mon-Sun)
  const acuteSessions = sessions.filter(
    (s) => isInCurrentWeek(new Date(s.session.started_at))
  );
  const acuteLoad = acuteSessions.reduce(
    (sum, s) => sum + s.sets.reduce((v, set) => v + set.weight_kg * set.reps_completed, 0),
    0
  );

  // Chronic load = average weekly volume over last 4 calendar weeks
  let chronicTotal = 0;
  let weeksWithData = 0;
  for (let w = 1; w <= 4; w++) {
    const weekSessions = sessions.filter(
      (s) => isInWeek(new Date(s.session.started_at), w)
    );
    const weekVol = weekSessions.reduce(
      (sum, s) => sum + s.sets.reduce((v, set) => v + set.weight_kg * set.reps_completed, 0),
      0
    );
    if (weekVol > 0) weeksWithData++;
    chronicTotal += weekVol;
  }
  const chronicLoad = weeksWithData > 0 ? chronicTotal / 4 : 0;

  if (chronicLoad === 0) {
    return {
      ratio: 0,
      acuteLoad,
      chronicLoad: 0,
      zone: "undertrained",
      message: "Insufficient data — need 4+ weeks of training history",
    };
  }

  const ratio = acuteLoad / chronicLoad;

  let zone: ACWRResult["zone"];
  let message: string;

  if (ratio < 0.8) {
    zone = "undertrained";
    message = "Low load — undertraining risk. Increase volume gradually.";
  } else if (ratio <= 1.3) {
    zone = "safe";
    message = "Optimal load — you're in the sweet spot.";
  } else if (ratio <= 1.5) {
    zone = "caution";
    message = "Elevated load — monitor for fatigue. Consider a lighter session.";
  } else {
    zone = "high_risk";
    message = "High injury risk! Spiking load too fast — deload recommended.";
  }

  return { ratio, acuteLoad, chronicLoad, zone, message };
}

// ---- 2. Training Monotony ----
// Foster (1998) — overtraining indicator
// Monotony = Weekly Average Daily Load / Std Dev of Daily Load
// High monotony (>2.0) = overtraining risk
export interface MonotonyResult {
  monotony: number;
  avgDailyLoad: number;
  stdDev: number;
  risk: "low" | "moderate" | "high";
}

export function computeMonotony(
  sessions: Array<{ session: Session; sets: SessionSet[] }>
): MonotonyResult | null {
  // Daily load for the current calendar week (Mon-Sun)
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const dailyLoads: number[] = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  for (const s of sessions) {
    const d = new Date(s.session.started_at);
    if (d >= weekStart && d < weekEnd) {
      const dayIdx = d.getDay();
      const vol = s.sets.reduce((v, set) => v + set.weight_kg * set.reps_completed, 0);
      dailyLoads[dayIdx] += vol;
    }
  }

  const total = dailyLoads.reduce((a, b) => a + b, 0);
  const avg = total / 7;
  
  if (avg === 0) return null;

  const variance = dailyLoads.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / 7;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  const monotony = avg / stdDev;

  let risk: MonotonyResult["risk"];
  if (monotony < 1.0) risk = "low";
  else if (monotony < 2.0) risk = "moderate";
  else risk = "high";

  return { monotony, avgDailyLoad: avg, stdDev, risk };
}

// ---- 3. Weekly Sets per Muscle Group ----
// Schoenfeld (2017) — 10-20 sets/week optimal for hypertrophy
// Below 10 = undertrained, above 20 = junk volume
export interface MuscleVolumeResult {
  muscle: string;
  weeklySets: number;
  weeklyVolume: number;
  zone: "undertrained" | "optimal" | "junk";
  color: string;
}

export function computeWeeklySetsPerMuscle(
  sessions: Array<{ session: Session; sets: SessionSet[] }>,
  exercises: Array<{ id: string; target_muscle: string }>
): MuscleVolumeResult[] {
  // Current calendar week (Mon-Sun)
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const exMap = new Map(exercises.map((e) => [e.id, e.target_muscle]));
  const byMuscle = new Map<string, { sets: number; volume: number }>();

  for (const s of sessions) {
    const d = new Date(s.session.started_at);
    if (d < weekStart || d >= weekEnd) continue;
    for (const set of s.sets) {
      const muscle = exMap.get(set.exercise_id ?? "") ?? "unknown";
      const existing = byMuscle.get(muscle) ?? { sets: 0, volume: 0 };
      existing.sets += 1;
      existing.volume += set.weight_kg * set.reps_completed;
      byMuscle.set(muscle, existing);
    }
  }

  const results: MuscleVolumeResult[] = [];
  for (const [muscle, data] of byMuscle) {
    let zone: MuscleVolumeResult["zone"];
    let color: string;
    if (data.sets < 10) {
      zone = "undertrained";
      color = "#ef4444"; // red
    } else if (data.sets <= 20) {
      zone = "optimal";
      color = "#10b981"; // green
    } else {
      zone = "junk";
      color = "#f59e0b"; // amber
    }
    results.push({
      muscle,
      weeklySets: data.sets,
      weeklyVolume: data.volume,
      zone,
      color,
    });
  }

  return results.sort((a, b) => b.weeklySets - a.weeklySets);
}

// ---- 4. Reps in Reserve (RIR) from RPE ----
// RIR = 10 - RPE
// RPE 10 = 0 RIR (failure), RPE 7 = 3 RIR
export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe);
}

// ---- 5. Session Density ----
// Density = Total Volume / Duration (minutes)
// Higher = more efficient workout
export function computeSessionDensity(
  session: Session,
  sets: SessionSet[]
): { density: number; volume: number; durationMin: number } | null {
  if (!session.ended_at) return null;
  
  const volume = sets.reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0);
  const durationMs = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
  const durationMin = Math.round(durationMs / 60000);
  
  if (durationMin === 0) return null;
  
  return {
    density: Math.round(volume / durationMin),
    volume,
    durationMin,
  };
}

// ============================================================
// PHASE 2 — Coaching Insights
// ============================================================

// ---- 6. Brzycki 1RM (more accurate for <6 reps) ----
export function estimate1RMBrzycki(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return (weight * 36) / (37 - reps);
}

// ---- 7. Relative Volume (VL/BW) ----
export function computeRelativeVolume(
  totalVolume: number,
  bodyweight: number | null
): number | null {
  if (!bodyweight || bodyweight <= 0) return null;
  return Math.round(totalVolume / bodyweight);
}

// ---- 8. Push:Pull Ratio ----
const PUSH_MUSCLES = ["chest", "shoulders", "triceps", "quads"];
const PULL_MUSCLES = ["back", "biceps", "hamstrings", "glutes"];

export interface PushPullResult {
  pushVolume: number;
  pullVolume: number;
  ratio: string;
  balance: "balanced" | "push_dominant" | "pull_dominant";
}

export function computePushPullRatio(
  sessions: Array<{ session: Session; sets: SessionSet[] }>,
  exercises: Array<{ id: string; target_muscle: string }>
): PushPullResult {
  const exMap = new Map(exercises.map((e) => [e.id, e.target_muscle]));
  let pushVol = 0;
  let pullVol = 0;

  for (const s of sessions) {
    for (const set of s.sets) {
      const muscle = (exMap.get(set.exercise_id ?? "") ?? "").toLowerCase();
      const vol = set.weight_kg * set.reps_completed;
      if (PUSH_MUSCLES.some((m) => muscle.includes(m))) pushVol += vol;
      else if (PULL_MUSCLES.some((m) => muscle.includes(m))) pullVol += vol;
    }
  }

  const total = pushVol + pullVol;
  let balance: PushPullResult["balance"];
  if (total === 0) balance = "balanced";
  else if (pushVol > pullVol * 1.3) balance = "push_dominant";
  else if (pullVol > pushVol * 1.3) balance = "pull_dominant";
  else balance = "balanced";

  const ratio =
    pullVol > 0
      ? `${(pushVol / pullVol).toFixed(1)}:1`
      : pushVol > 0
      ? "∞:0"
      : "0:0";

  return { pushVolume: pushVol, pullVolume: pullVol, ratio, balance };
}

// ---- 9. Strength Standards ----
export interface StrengthStandard {
  exercise: string;
  oneRM: number;
  bodyweight: number;
  ratio: number;
  level: "beginner" | "novice" | "intermediate" | "advanced" | "elite";
  color: string;
}

const STRENGTH_TABLES: Record<string, Array<{ ratio: number; level: StrengthStandard["level"]; color: string }>> = {
  bench: [
    { ratio: 0.5, level: "beginner", color: "#ef4444" },
    { ratio: 0.75, level: "novice", color: "#f97316" },
    { ratio: 1.0, level: "intermediate", color: "#f59e0b" },
    { ratio: 1.5, level: "advanced", color: "#84cc16" },
    { ratio: 2.0, level: "elite", color: "#10b981" },
  ],
  squat: [
    { ratio: 0.5, level: "beginner", color: "#ef4444" },
    { ratio: 0.75, level: "novice", color: "#f97316" },
    { ratio: 1.25, level: "intermediate", color: "#f59e0b" },
    { ratio: 1.75, level: "advanced", color: "#84cc16" },
    { ratio: 2.5, level: "elite", color: "#10b981" },
  ],
  deadlift: [
    { ratio: 0.75, level: "beginner", color: "#ef4444" },
    { ratio: 1.0, level: "novice", color: "#f97316" },
    { ratio: 1.5, level: "intermediate", color: "#f59e0b" },
    { ratio: 2.25, level: "advanced", color: "#84cc16" },
    { ratio: 3.0, level: "elite", color: "#10b981" },
  ],
  overhead: [
    { ratio: 0.4, level: "beginner", color: "#ef4444" },
    { ratio: 0.6, level: "novice", color: "#f97316" },
    { ratio: 0.75, level: "intermediate", color: "#f59e0b" },
    { ratio: 1.0, level: "advanced", color: "#84cc16" },
    { ratio: 1.5, level: "elite", color: "#10b981" },
  ],
};

export function computeStrengthStandards(
  sessions: Array<{ session: Session; sets: SessionSet[] }>,
  bodyweight: number | null
): StrengthStandard[] {
  if (!bodyweight) return [];

  const results: StrengthStandard[] = [];
  const exerciseMap: Record<string, { best1RM: number; table: string }> = {
    bench: { best1RM: 0, table: "bench" },
    squat: { best1RM: 0, table: "squat" },
    deadlift: { best1RM: 0, table: "deadlift" },
    press: { best1RM: 0, table: "overhead" },
  };

  for (const s of sessions) {
    for (const set of s.sets) {
      const name = set.exercise_name.toLowerCase();
      const oneRM = estimate1RM(set.weight_kg, set.reps_completed);
      if (name.includes("bench") || name.includes("chest press")) {
        if (oneRM > exerciseMap.bench.best1RM) exerciseMap.bench.best1RM = oneRM;
      } else if (name.includes("squat")) {
        if (oneRM > exerciseMap.squat.best1RM) exerciseMap.squat.best1RM = oneRM;
      } else if (name.includes("deadlift")) {
        if (oneRM > exerciseMap.deadlift.best1RM) exerciseMap.deadlift.best1RM = oneRM;
      } else if (name.includes("overhead") || name.includes("shoulder press")) {
        if (oneRM > exerciseMap.press.best1RM) exerciseMap.press.best1RM = oneRM;
      }
    }
  }

  for (const [key, data] of Object.entries(exerciseMap)) {
    if (data.best1RM === 0) continue;
    const ratio = data.best1RM / bodyweight;
    const table = STRENGTH_TABLES[data.table];
    let level: StrengthStandard["level"] = "beginner";
    let color = "#ef4444";
    for (const tier of table) {
      if (ratio >= tier.ratio) {
        level = tier.level;
        color = tier.color;
      }
    }
    const exerciseName = {
      bench: "Bench Press",
      squat: "Squat",
      deadlift: "Deadlift",
      press: "Overhead Press",
    }[key];
    results.push({ exercise: exerciseName, oneRM: data.best1RM, bodyweight, ratio, level, color });
  }

  return results;
}

// ---- 10. Deload Recommendation ----
export interface DeloadRecommendation {
  shouldDeload: boolean;
  reasons: string[];
  severity: "none" | "suggested" | "recommended" | "critical";
}

export function computeDeloadRecommendation(
  sessions: Array<{ session: Session; sets: SessionSet[] }>,
  acwr: ACWRResult | null,
  monotony: MonotonyResult | null
): DeloadRecommendation {
  const reasons: string[] = [];
  let severity: DeloadRecommendation["severity"] = "none";

  // Check 1: ACWR > 1.5
  if (acwr && acwr.ratio > 1.5) {
    reasons.push(`ACWR at ${acwr.ratio.toFixed(2)} — load spiking too fast`);
    severity = "critical";
  } else if (acwr && acwr.ratio > 1.3) {
    reasons.push(`ACWR at ${acwr.ratio.toFixed(2)} — elevated load`);
    if (severity === "none") severity = "suggested";
  }

  // Check 2: Monotony > 2.0
  if (monotony && monotony.monotony > 2.0) {
    reasons.push(`Monotony at ${monotony.monotony.toFixed(2)} — low variation in training`);
    if (severity !== "critical") severity = "recommended";
  }

  // Check 3: Volume increase >15% for 3 consecutive weeks (calendar weeks)
  const weeklyVolumes: number[] = [];
  for (let i = 3; i >= 0; i--) {
    const ws = getWeekStartNWeeksAgo(i);
    const we = getWeekEndNWeeksAgo(i);
    const vol = sessions
      .filter((s) => {
        const d = new Date(s.session.started_at);
        return d >= ws && d <= we;
      })
      .reduce((sum, s) => sum + s.sets.reduce((v, set) => v + set.weight_kg * set.reps_completed, 0), 0);
    weeklyVolumes.push(vol);
  }

  if (weeklyVolumes.length >= 4 && weeklyVolumes[0] > 0) {
    let consecutiveIncreases = 0;
    let allAbove15 = true;
    for (let i = 1; i < weeklyVolumes.length; i++) {
      if (weeklyVolumes[i] > weeklyVolumes[i - 1]) {
        consecutiveIncreases++;
        const increase = (weeklyVolumes[i] - weeklyVolumes[i - 1]) / weeklyVolumes[i - 1];
        if (increase < 0.15) allAbove15 = false;
      }
    }
    if (consecutiveIncreases >= 3 && allAbove15) {
      reasons.push("Volume increased >15% for 3 consecutive weeks");
      if (severity !== "critical") severity = "recommended";
    }
  }

  return {
    shouldDeload: severity !== "none",
    reasons,
    severity,
  };
}

// ============================================================
// PHASE 3 — Advanced Metrics
// ============================================================

// ---- 11. Training Strain ----
// Strain = Monotony × Weekly Total Load
export function computeTrainingStrain(
  monotony: MonotonyResult | null
): { strain: number; level: string; color: string } | null {
  if (!monotony) return null;
  const strain = monotony.monotony * monotony.avgDailyLoad * 7;
  if (strain < 5000) return { strain, level: "Low", color: "#10b981" };
  if (strain < 15000) return { strain, level: "Moderate", color: "#f59e0b" };
  return { strain, level: "High", color: "#ef4444" };
}

// ---- 12. Relative Intensity per set ----
// RI = (Set Weight / 1RM) × 100
export function computeRelativeIntensity(setWeight: number, oneRM: number): number {
  if (oneRM <= 0) return 0;
  return (setWeight / oneRM) * 100;
}

// ---- 13. Power Output Estimate ----
// Power = (Weight × 9.8 × distance) / time_per_rep
// Approximate bar distances per exercise type
const BAR_DISTANCES: Record<string, number> = {
  bench: 0.5,
  squat: 0.7,
  deadlift: 0.5,
  press: 0.4,
  row: 0.4,
  curl: 0.3,
  default: 0.4,
};

export function estimatePowerOutput(
  weight: number,
  exerciseName: string,
  timePerRep: number = 2
): { watts: number; wattsPerKg: number | null } {
  const name = exerciseName.toLowerCase();
  let distance = BAR_DISTANCES.default;
  for (const [key, d] of Object.entries(BAR_DISTANCES)) {
    if (name.includes(key)) {
      distance = d;
      break;
    }
  }
  // Power = force × distance / time = (mass × g × distance) / time
  const watts = (weight * 9.8 * distance) / timePerRep;
  return { watts: Math.round(watts), wattsPerKg: null };
}

// ---- 14. Workout Efficiency Score ----
// Efficiency = (Actual Volume / Planned Volume) × 100
export function computeWorkoutEfficiency(
  actualVolume: number,
  plannedExercises: number,
  completedExercises: number
): { efficiency: number; completed: number; planned: number } {
  const exerciseCompletion = plannedExercises > 0 ? (completedExercises / plannedExercises) * 100 : 0;
  return {
    efficiency: Math.round(exerciseCompletion),
    completed: completedExercises,
    planned: plannedExercises,
  };
}
