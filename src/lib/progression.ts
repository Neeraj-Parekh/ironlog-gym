// ============================================================
// PR tracking, streak calculation, milestone detection
// Runs after every session completion
// ============================================================
import { getDB } from "./dexie";
import { estimate1RM } from "./analytics";
import type { Session, SessionSet, PersonalRecord, Milestone, StreakRecord } from "./types";
import { uid } from "./utils";

// ---- Check & record PRs after a session ----
export async function checkAndRecordPRs(
  session: Session,
  sets: SessionSet[]
): Promise<PersonalRecord[]> {
  const db = getDB();
  const newPRs: PersonalRecord[] = [];

  // Group sets by exercise
  const byExercise = new Map<string, SessionSet[]>();
  for (const s of sets) {
    if (!s.exercise_id) continue;
    if (!byExercise.has(s.exercise_id)) byExercise.set(s.exercise_id, []);
    byExercise.get(s.exercise_id)!.push(s);
  }

  for (const [exerciseId, exSets] of byExercise) {
    // Find best set by estimated 1RM
    const best = exSets.reduce((best, s) => {
      const best1rm = estimate1RM(best.weight_kg, best.reps_completed);
      const s1rm = estimate1RM(s.weight_kg, s.reps_completed);
      return s1rm > best1rm ? s : best;
    }, exSets[0]);

    const est1rm = estimate1RM(best.weight_kg, best.reps_completed);
    if (est1rm <= 0) continue;

    // Check existing PR
    const existingPR = await db.personal_records
      .where("exercise_id")
      .equals(exerciseId)
      .reverse()
      .sortBy("estimated_1rm")
      .then((arr) => arr[0]);

    if (!existingPR || est1rm > existingPR.estimated_1rm) {
      const pr: PersonalRecord = {
        id: uid("pr"),
        exercise_id: exerciseId,
        exercise_name: best.exercise_name,
        estimated_1rm: est1rm,
        weight_kg: best.weight_kg,
        reps: best.reps_completed,
        session_id: session.id,
        achieved_at: session.started_at,
      };
      await db.personal_records.put(pr);
      newPRs.push(pr);
    }
  }

  return newPRs;
}

// ---- Update streak after a session ----
export async function updateStreak(sessionDate: string): Promise<{
  current: number;
  longest: number;
  isNew: boolean;
}> {
  const db = getDB();
  const existing = await db.streak.toArray();
  let streakRecord: StreakRecord | undefined = existing[0];

  const today = sessionDate;
  // Use calendar date subtraction to handle DST correctly
  const now = new Date();
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  if (!streakRecord) {
    // First ever session
    streakRecord = {
      id: uid("streak"),
      current_streak: 1,
      longest_streak: 1,
      last_workout_date: today,
      updated_at: new Date().toISOString(),
    };
    await db.streak.put(streakRecord);
    return { current: 1, longest: 1, isNew: true };
  }

  // If already counted today, don't double-count
  if (streakRecord.last_workout_date === today) {
    return {
      current: streakRecord.current_streak,
      longest: streakRecord.longest_streak,
      isNew: false,
    };
  }

  // If last workout was yesterday, increment streak
  if (streakRecord.last_workout_date === yesterday) {
    streakRecord.current_streak += 1;
  } else {
    // Streak broken — reset to 1
    streakRecord.current_streak = 1;
  }

  streakRecord.last_workout_date = today;
  streakRecord.longest_streak = Math.max(
    streakRecord.longest_streak,
    streakRecord.current_streak
  );
  streakRecord.updated_at = new Date().toISOString();

  await db.streak.put(streakRecord);
  return {
    current: streakRecord.current_streak,
    longest: streakRecord.longest_streak,
    isNew: true,
  };
}

// ---- Check milestones after a session ----
const MILESTONE_THRESHOLDS = {
  total_volume: [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
  session_count: [1, 5, 10, 25, 50, 100, 250, 500],
  streak: [3, 7, 14, 30, 60, 90, 180, 365],
  first_1rm: [1], // first ever PR
};

export async function checkMilestones(
  totalVolume: number,
  sessionCount: number,
  currentStreak: number,
  newPRs: PersonalRecord[]
): Promise<Milestone[]> {
  const db = getDB();
  const existingMilestones = await db.milestones.toArray();
  const existingKeys = new Set(
    existingMilestones.map((m) => `${m.type}:${m.value}`)
  );
  const newMilestones: Milestone[] = [];

  const checkThreshold = (
    type: Milestone["type"],
    value: number,
    currentValue: number,
    unit: string,
    labelFn: (v: number) => string
  ) => {
    for (const threshold of MILESTONE_THRESHOLDS[type]) {
      if (currentValue >= threshold && !existingKeys.has(`${type}:${threshold}`)) {
        const milestone: Milestone = {
          id: uid("milestone"),
          type,
          label: labelFn(threshold),
          description: `Achieved ${threshold.toLocaleString()} ${unit}`,
          achieved_at: new Date().toISOString(),
          value: threshold,
          unit,
        };
        newMilestones.push(milestone);
        existingKeys.add(`${type}:${threshold}`);
      }
    }
  };

  // Total volume milestones
  checkThreshold(
    "total_volume",
    0,
    totalVolume,
    "kg",
    (v) => `${(v / 1000).toFixed(0)}k kg Club`
  );

  // Session count milestones
  checkThreshold(
    "session_count",
    0,
    sessionCount,
    "sessions",
    (v) => `${v} Sessions Logged`
  );

  // Streak milestones
  checkThreshold(
    "streak",
    0,
    currentStreak,
    "days",
    (v) => `${v}-Day Streak`
  );

  // First PR milestone
  if (newPRs.length > 0 && !existingKeys.has("first_1rm:1")) {
    const milestone: Milestone = {
      id: uid("milestone"),
      type: "first_1rm",
      label: "First PR!",
      description: "Set your first personal record",
      achieved_at: new Date().toISOString(),
      value: 1,
      unit: "pr",
    };
    newMilestones.push(milestone);
  }

  if (newMilestones.length > 0) {
    await db.milestones.bulkPut(newMilestones);
  }

  return newMilestones;
}

// ---- Get progression suggestions for an exercise ----
export interface ProgressionSuggestion {
  exercise_id: string;
  exercise_name: string;
  lastWeight: number;
  lastReps: number;
  suggestedWeight: number;
  suggestedReps: number;
  reason: string;
  trend: "increase" | "maintain" | "deload";
}

export async function getProgressionSuggestion(
  exerciseId: string
): Promise<ProgressionSuggestion | null> {
  const db = getDB();
  // Get last 3 sessions for this exercise
  const recentSets = await db.session_sets
    .where("exercise_id")
    .equals(exerciseId)
    .reverse()
    .sortBy("logged_at");

  if (recentSets.length === 0) return null;

  // Group by session
  const bySession = new Map<string, SessionSet[]>();
  for (const s of recentSets) {
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
    bySession.get(s.session_id)!.push(s);
  }

  const sessions = Array.from(bySession.values()).slice(0, 3);
  if (sessions.length === 0) return null;

  const lastSession = sessions[0];
  const lastBest = lastSession.reduce((best, s) => {
    const b1rm = estimate1RM(best.weight_kg, best.reps_completed);
    const s1rm = estimate1RM(s.weight_kg, s.reps_completed);
    return s1rm > b1rm ? s : best;
  }, lastSession[0]);

  // If 3+ sessions at same weight with all reps hitting target, suggest increase
  if (sessions.length >= 3) {
    const allHitTarget = sessions.every((sessionSets) => {
      return sessionSets.every(
        (s) => s.reps_completed >= (s.weight_kg === lastBest.weight_kg ? 8 : 0)
      );
    });
    const sameWeight = sessions.every(
      (sessionSets) =>
        Math.max(...sessionSets.map((s) => s.weight_kg)) >= lastBest.weight_kg
    );

    if (allHitTarget && sameWeight) {
      return {
        exercise_id: exerciseId,
        exercise_name: lastBest.exercise_name,
        lastWeight: lastBest.weight_kg,
        lastReps: lastBest.reps_completed,
        suggestedWeight: lastBest.weight_kg + 2.5,
        suggestedReps: lastBest.reps_completed,
        reason: "Hit target for 3+ sessions — time to increase weight",
        trend: "increase",
      };
    }
  }

  // If RPE was 9-10 on last session, suggest maintain or deload
  const highRPE = lastSession.some((s) => (s.rpe ?? 0) >= 9);
  if (highRPE) {
    return {
      exercise_id: exerciseId,
      exercise_name: lastBest.exercise_name,
      lastWeight: lastBest.weight_kg,
      lastReps: lastBest.reps_completed,
      suggestedWeight: lastBest.weight_kg,
      suggestedReps: lastBest.reps_completed,
      reason: "High RPE last session — maintain weight, focus on form",
      trend: "maintain",
    };
  }

  return {
    exercise_id: exerciseId,
    exercise_name: lastBest.exercise_name,
    lastWeight: lastBest.weight_kg,
    lastReps: lastBest.reps_completed,
    suggestedWeight: lastBest.weight_kg,
    suggestedReps: lastBest.reps_completed + 1,
    reason: "Add 1 rep before increasing weight",
    trend: "increase",
  };
}
