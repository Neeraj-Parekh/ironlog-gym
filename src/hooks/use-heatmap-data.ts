"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type { Session, SessionSet, Exercise } from "@/lib/types";

export interface DayVolume {
  date: string; // YYYY-MM-DD
  volume: number;
  sessionCount: number;
  hasPR: boolean;
}

export interface MuscleDayVolume {
  muscle: string;
  dayOfWeek: number;
  volume: number;
}

export interface SessionCompletion {
  date: string;
  dayOfWeek: number;
  status: "completed" | "missed" | "rest" | "upcoming" | "partial";
  volume: number;
}

// ---- Annual heatmap: volume per day for the whole year ----
export function useAnnualHeatmap(year: number = new Date().getFullYear()) {
  const [data, setData] = useState<DayVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .filter((s) => s.date >= yearStart && s.date <= yearEnd)
        .toArray();

      const allSets = await db.session_sets.toArray();
      const prs = await db.personal_records
        .where("achieved_at")
        .above(yearStart)
        .toArray();
      const prDates = new Set(prs.map((p) => p.achieved_at.slice(0, 10)));

      const byDate = new Map<string, DayVolume>();
      for (const session of sessions) {
        const sets = allSets.filter((s) => s.session_id === session.id);
        const vol = sets.reduce(
          (sum, s) => sum + s.weight_kg * s.reps_completed,
          0
        );
        const existing = byDate.get(session.date);
        if (existing) {
          existing.volume += vol;
          existing.sessionCount += 1;
          existing.hasPR = existing.hasPR || prDates.has(session.date);
        } else {
          byDate.set(session.date, {
            date: session.date,
            volume: vol,
            sessionCount: 1,
            hasPR: prDates.has(session.date),
          });
        }
      }

      if (!cancelled) {
        setData(Array.from(byDate.values()));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, reloadTick]);

  return { data, loading, reload };
}

// ---- Muscle × Day-of-Week heatmap ----
export function useMuscleDayHeatmap() {
  const [data, setData] = useState<MuscleDayVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .toArray();
      const allSets = await db.session_sets.toArray();
      const exercises = await db.exercises.toArray();
      const exMap = new Map(exercises.map((e) => [e.id, e]));

      const byMuscleDay = new Map<string, number>();

      for (const set of allSets) {
        const ex = exMap.get(set.exercise_id ?? "");
        if (!ex) continue;
        const session = sessions.find((s) => s.id === set.session_id);
        if (!session) continue;
        const key = `${ex.target_muscle}|${session.day_of_week}`;
        const vol = set.weight_kg * set.reps_completed;
        byMuscleDay.set(key, (byMuscleDay.get(key) ?? 0) + vol);
      }

      const result: MuscleDayVolume[] = [];
      for (const [key, vol] of byMuscleDay) {
        const [muscle, dayStr] = key.split("|");
        result.push({ muscle, dayOfWeek: Number(dayStr), volume: vol });
      }

      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { data, loading, reload };
}

// ---- Weekly session completion (for the M-S grid) ----
export function useWeeklyCompletion(weekOffset: number = 0) {
  const [data, setData] = useState<SessionCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const now = new Date();
      // Find Monday of the target week
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
      monday.setHours(0, 0, 0, 0);

      const weekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        weekDates.push(d.toISOString().slice(0, 10));
      }

      // Get active routine to know which days are prescribed
      const version =
        (await db.routine_versions
          .where("is_active")
          .equals(1 as never)
          .first()) ??
        (await db.routine_versions.orderBy("created_at").reverse().first());

      let prescribedDays = new Set<number>();
      if (version) {
        const nodes = await db.routine_nodes
          .where("version_id")
          .equals(version.id)
          .filter((n) => n.block_type === "exercise")
          .toArray();
        prescribedDays = new Set(nodes.map((n) => n.day_of_week));
      }

      // Get sessions for this week
      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .filter((s) => weekDates.includes(s.date))
        .toArray();

      const allSets = await db.session_sets.toArray();
      const today = new Date().toISOString().slice(0, 10);
      const result: SessionCompletion[] = [];

      for (let i = 0; i < 7; i++) {
        const dateStr = weekDates[i];
        const dayOfWeek = (i + 1) % 7; // Monday=1 ... Sunday=0
        const session = sessions.find((s) => s.date === dateStr);
        const isPrescribed = prescribedDays.has(dayOfWeek);
        const isPast = dateStr < today;
        const isToday = dateStr === today;

        let status: SessionCompletion["status"];
        if (session) {
          // Check if all exercises were completed
          const sets = allSets.filter((s) => s.session_id === session.id);
          status = sets.length > 0 ? "completed" : "partial";
        } else if (isPrescribed && isPast) {
          status = "missed";
        } else if (isPrescribed && (isToday || !isPast)) {
          status = "upcoming";
        } else {
          status = "rest";
        }

        const vol = session
          ? allSets
              .filter((s) => s.session_id === session.id)
              .reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0)
          : 0;

        result.push({ date: dateStr, dayOfWeek, status, volume: vol });
      }

      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekOffset, reloadTick]);

  return { data, loading, reload };
}

// ---- Weekly stacked volume by muscle group ----
export function useWeeklyStackedVolume() {
  const [data, setData] = useState<
    Array<{ day: string; [muscle: string]: number | string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      // Use calendar week (Mon-Sun) instead of rolling 7 days
      const { getWeekStart, getWeekEnd } = await import("@/lib/calendar-weeks");
      const weekStart = getWeekStart();
      const weekEnd = getWeekEnd();

      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .filter((s) => {
          const d = new Date(s.started_at);
          return d >= weekStart && d <= weekEnd;
        })
        .toArray();

      const allSets = await db.session_sets.toArray();
      const exercises = await db.exercises.toArray();
      const exMap = new Map(exercises.map((e) => [e.id, e]));

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const byDay: Array<{ day: string; [muscle: string]: number | string }> =
        dayNames.map((d) => ({ day: d }));

      for (const session of sessions) {
        const sets = allSets.filter((s) => s.session_id === session.id);
        const dayIdx = session.day_of_week;
        for (const set of sets) {
          const ex = exMap.get(set.exercise_id ?? "");
          if (!ex) continue;
          const muscle = ex.target_muscle;
          const vol = set.weight_kg * set.reps_completed;
          byDay[dayIdx][muscle] = ((byDay[dayIdx][muscle] as number) ?? 0) + vol;
        }
      }

      if (!cancelled) {
        setData(byDay);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { data, loading, reload };
}

// ---- Streak + monthly session count + weekly volume (for rings) ----
export function useRingStats() {
  const [stats, setStats] = useState({
    weeklyVolume: 0,
    weeklyVolumeGoal: 10000,
    monthlySessions: 0,
    monthlySessionGoal: 16,
    currentStreak: 0,
    streakGoal: 30,
  });
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const now = new Date();

      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .toArray();
      const allSets = await db.session_sets.toArray();
      const streak = await db.streak.toArray();

      // Weekly volume — calendar week (Mon-Sun)
      const { getWeekStart, getWeekEnd } = await import("@/lib/calendar-weeks");
      const weekStart = getWeekStart();
      const weekEnd = getWeekEnd();
      const weeklySessions = sessions.filter((s) => {
        const d = new Date(s.started_at);
        return d >= weekStart && d <= weekEnd;
      });
      const weeklyVolume = weeklySessions.reduce((sum, s) => {
        const sets = allSets.filter((set) => set.session_id === s.id);
        return sum + sets.reduce((v, set) => v + set.weight_kg * set.reps_completed, 0);
      }, 0);

      // Monthly sessions — calendar month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlySessions = sessions.filter(
        (s) => new Date(s.started_at) >= monthStart
      ).length;

      // Streak
      const currentStreak = streak[0]?.current_streak ?? 0;

      if (!cancelled) {
        setStats({
          weeklyVolume,
          weeklyVolumeGoal: 10000,
          monthlySessions,
          monthlySessionGoal: 16,
          currentStreak,
          streakGoal: 30,
        });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { stats, loading, reload };
}
