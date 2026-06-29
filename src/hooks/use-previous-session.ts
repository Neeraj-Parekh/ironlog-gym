"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import { estimate1RM } from "@/lib/analytics";
import type { SessionSet } from "@/lib/types";

export interface PreviousSessionData {
  date: string;
  sets: SessionSet[];
  bestWeight: number;
  bestReps: number;
  best1RM: number;
  totalVolume: number;
}

/**
 * Fetches the most recent completed session for an exercise
 * (excluding the current active session).
 */
export function usePreviousSession(
  exerciseId: string | undefined,
  currentSessionId: string | undefined
): { data: PreviousSessionData | null; loading: boolean } {
  const [data, setData] = useState<PreviousSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!exerciseId) {
        setData(null);
        setLoading(false);
        return;
      }
      const db = getDB();
      // Get all sessions for this exercise
      const allSets = await db.session_sets
        .where("exercise_id")
        .equals(exerciseId)
        .toArray();

      // Group by session
      const bySession = new Map<string, SessionSet[]>();
      for (const s of allSets) {
        if (s.session_id === currentSessionId) continue; // exclude current
        if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
        bySession.get(s.session_id)!.push(s);
      }

      if (bySession.size === 0) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      // Get the most recent session
      const sessions = await db.sessions.bulkGet(Array.from(bySession.keys()));
      const validSessions = sessions
        .filter((s): s is NonNullable<typeof s> => !!s)
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() -
            new Date(a.started_at).getTime()
        );

      if (validSessions.length === 0) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const recentSession = validSessions[0];
      const recentSets = bySession.get(recentSession.id) ?? [];

      const best = recentSets.reduce((best, s) => {
        const b1rm = estimate1RM(best.weight_kg, best.reps_completed);
        const s1rm = estimate1RM(s.weight_kg, s.reps_completed);
        return s1rm > b1rm ? s : best;
      }, recentSets[0]);

      const totalVolume = recentSets.reduce(
        (sum, s) => sum + s.weight_kg * s.reps_completed,
        0
      );

      if (!cancelled) {
        setData({
          date: recentSession.date,
          sets: recentSets.sort((a, b) => a.set_index - b.set_index),
          bestWeight: best.weight_kg,
          bestReps: best.reps_completed,
          best1RM: estimate1RM(best.weight_kg, best.reps_completed),
          totalVolume,
        });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId, currentSessionId]);

  return { data, loading };
}

// ---- Total workout timer hook ----
export function useWorkoutTimer(
  startedAt: string | undefined,
  isRunning: boolean
): { elapsed: number; formatted: string } {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || !isRunning) return;
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isRunning]);

  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const formatted =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return { elapsed, formatted };
}
