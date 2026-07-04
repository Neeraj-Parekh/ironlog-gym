"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import { computeVitalityScore } from "@/lib/vitality";
import { uid } from "@/lib/utils";
import type {
  SessionSoreness,
  PreWorkoutContext,
  VitalityLog,
  Session,
} from "@/lib/types";

// ---- DOMS: Sessions needing soreness check (24-72h post-completion) ----
export function useSessionsNeedingSoreness() {
  const [sessions, setSessions] = useState<
    Array<{ session: Session; hoursAgo: number }>
  >([]);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const now = Date.now();
      const cutoff72h = new Date(now - 72 * 60 * 60 * 1000).toISOString();
      const cutoff24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      // Get completed sessions in 24-72h window
      const recentSessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .filter((s) => !!(s.ended_at && s.ended_at >= cutoff72h && s.ended_at <= cutoff24h))
        .toArray();

      // Filter out sessions that already have soreness logged
      const existingSoreness = await db.session_soreness.toArray();
      const sessionsWithSoreness = new Set(
        existingSoreness.map((s) => s.session_id)
      );

      const needing = recentSessions
        .filter((s) => !sessionsWithSoreness.has(s.id))
        .map((s) => ({
          session: s,
          hoursAgo: Math.round(
            (now - new Date(s.ended_at || s.started_at).getTime()) / 3600000
          ),
        }));

      if (!cancelled) setSessions(needing);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const logSoreness = useCallback(
    async (
      sessionId: string,
      overallLevel: 1 | 2 | 3 | 4 | 5,
      muscleEntries: Array<{ muscle: string; level: 1 | 2 | 3 | 4 | 5 }>,
      hoursAfterSession: number,
      notes?: string
    ) => {
      const db = getDB();
      const entry: SessionSoreness = {
        id: uid("soreness"),
        session_id: sessionId,
        logged_at: new Date().toISOString(),
        overall_level: overallLevel,
        muscle_entries: muscleEntries,
        hours_after_session: hoursAfterSession,
        notes,
      };
      await db.session_soreness.put(entry);
      setReloadTick((t) => t + 1);
    },
    []
  );

  return { sessions, logSoreness, reload };
}

// ---- Pre-Workout Context ----
export function usePreWorkoutContext(sessionId: string | null) {
  const [context, setContext] = useState<PreWorkoutContext | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionId) {
        setContext(null);
        return;
      }
      const db = getDB();
      const existing = await db.pre_workout_context
        .where("session_id")
        .equals(sessionId)
        .first();
      if (!cancelled) setContext(existing ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadTick]);

  const saveContext = useCallback(
    async (data: Omit<PreWorkoutContext, "id">) => {
      if (!sessionId) return;
      const db = getDB();
      const existing = await db.pre_workout_context
        .where("session_id")
        .equals(sessionId)
        .first();
      if (existing) {
        await db.pre_workout_context.update(existing.id, data);
      } else {
        await db.pre_workout_context.put({ ...data, id: uid("pwc") });
      }
      setReloadTick((t) => t + 1);
    },
    [sessionId]
  );

  return { context, saveContext, reload };
}

// ---- Vitality Log ----
export function useVitalityLog() {
  const [logs, setLogs] = useState<VitalityLog[]>([]);
  const [todayLog, setTodayLog] = useState<VitalityLog | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const all = await db.vitality_log.orderBy("date").reverse().toArray();
      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = all.find((l) => l.date === today) ?? null;
      if (!cancelled) {
        setLogs(all);
        setTodayLog(todayEntry);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const saveVitality = useCallback(
    async (input: {
      morning_erection: 0 | 1 | 2 | 3;
      libido: 1 | 2 | 3 | 4 | 5;
      drive: 1 | 2 | 3 | 4 | 5;
      confidence: 1 | 2 | 3 | 4 | 5;
      energy: 1 | 2 | 3 | 4 | 5;
      muscle_fullness: 1 | 2 | 3 | 4 | 5;
      sleep_quality: 1 | 2 | 3 | 4 | 5;
      notes?: string;
    }) => {
      const db = getDB();
      const today = new Date().toISOString().slice(0, 10);
      const score = computeVitalityScore(input);
      const existing = await db.vitality_log
        .where("date")
        .equals(today)
        .first();
      if (existing) {
        await db.vitality_log.update(existing.id, { ...input, computed_score: score });
      } else {
        await db.vitality_log.put({
          id: uid("vitality"),
          logged_at: new Date().toISOString(),
          date: today,
          ...input,
          computed_score: score,
        });
      }
      setReloadTick((t) => t + 1);
    },
    []
  );

  return { logs, todayLog, saveVitality, reload };
}

// ---- Vitality correlation insights ----
export interface VitalityInsight {
  text: string;
  delta: number;
  type: "positive" | "negative" | "neutral";
}

export function useVitalityInsights(
  vitalityLogCount: number = 0
): {
  insights: VitalityInsight[];
  loading: boolean;
} {
  const [insights, setInsights] = useState<VitalityInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const vitalityLogs = await db.vitality_log.orderBy("date").toArray();
      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .toArray();
      const allSets = await db.session_sets.toArray();

      if (vitalityLogs.length < 7) {
        if (!cancelled) {
          setInsights([]);
          setLoading(false);
        }
        return;
      }

      const generated: VitalityInsight[] = [];

      // Insight 1: Average score
      const avgScore =
        vitalityLogs.reduce((s, l) => s + l.computed_score, 0) /
        vitalityLogs.length;
      generated.push({
        text: `Average vitality: ${avgScore.toFixed(0)}/100 over ${vitalityLogs.length} days`,
        delta: avgScore,
        type: "neutral",
      });

      // Insight 2: Vitality 48h after heavy compound sessions vs other days
      const compoundExercises = ["bench_press", "squat", "deadlift", "row", "press"];
      const heavySessionDates = new Set<string>();
      for (const session of sessions) {
        const sets = allSets.filter((s) => s.session_id === session.id);
        const hasCompound = sets.some((s) =>
          compoundExercises.some((c) =>
            s.exercise_name.toLowerCase().includes(c.replace("_", " "))
          )
        );
        const volume = sets.reduce(
          (sum, s) => sum + s.weight_kg * s.reps_completed,
          0
        );
        if (hasCompound && volume > 2000) {
          heavySessionDates.add(session.date);
        }
      }

      const postHeavyScores: number[] = [];
      const otherScores: number[] = [];
      for (const log of vitalityLogs) {
        const logDate = new Date(log.date);
        const twoDaysBefore = new Date(logDate);
        twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
        const twoDaysBeforeStr = twoDaysBefore.toISOString().slice(0, 10);
        if (heavySessionDates.has(twoDaysBeforeStr)) {
          postHeavyScores.push(log.computed_score);
        } else {
          otherScores.push(log.computed_score);
        }
      }

      if (postHeavyScores.length >= 2 && otherScores.length >= 2) {
        const postHeavyAvg =
          postHeavyScores.reduce((a, b) => a + b, 0) / postHeavyScores.length;
        const otherAvg =
          otherScores.reduce((a, b) => a + b, 0) / otherScores.length;
        const delta = postHeavyAvg - otherAvg;
        if (Math.abs(delta) > 3) {
          generated.push({
            text: `Vitality is ${delta > 0 ? "+" : ""}${delta.toFixed(0)}% 48h after heavy compound sessions`,
            delta,
            type: delta > 0 ? "positive" : "negative",
          });
        }
      }

      // Insight 3: Sleep correlation
      const goodSleepScores: number[] = [];
      const poorSleepScores: number[] = [];
      for (const log of vitalityLogs) {
        if (log.sleep_quality >= 4) goodSleepScores.push(log.computed_score);
        else if (log.sleep_quality <= 2) poorSleepScores.push(log.computed_score);
      }
      if (goodSleepScores.length >= 2 && poorSleepScores.length >= 2) {
        const goodAvg =
          goodSleepScores.reduce((a, b) => a + b, 0) / goodSleepScores.length;
        const poorAvg =
          poorSleepScores.reduce((a, b) => a + b, 0) / poorSleepScores.length;
        const delta = goodAvg - poorAvg;
        if (Math.abs(delta) > 3) {
          generated.push({
            text: `Good sleep nights score ${delta > 0 ? "+" : ""}${delta.toFixed(0)}% higher than poor sleep nights`,
            delta,
            type: delta > 0 ? "positive" : "negative",
          });
        }
      }

      // Insight 4: Trend (last 7 vs prior 7)
      if (vitalityLogs.length >= 14) {
        const recent7 = vitalityLogs.slice(-7);
        const prior7 = vitalityLogs.slice(-14, -7);
        const recentAvg =
          recent7.reduce((s, l) => s + l.computed_score, 0) / recent7.length;
        const priorAvg =
          prior7.reduce((s, l) => s + l.computed_score, 0) / prior7.length;
        const delta = recentAvg - priorAvg;
        if (Math.abs(delta) > 2) {
          generated.push({
            text: `Vitality trend: ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)}% vs last week`,
            delta,
            type: delta > 0 ? "positive" : "negative",
          });
        }
      }

      if (!cancelled) {
        setInsights(generated);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vitalityLogCount]); // recompute when vitality log count changes

  return { insights, loading };
}
