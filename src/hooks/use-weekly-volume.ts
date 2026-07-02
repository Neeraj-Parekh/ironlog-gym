"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type { SessionSet, Session } from "@/lib/types";

// ---- Volume by day (for week heatmap) ----
export function useWeeklyVolume() {
  const [volumes, setVolumes] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  });
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

      const byDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const session of sessions) {
        const dayVol = allSets
          .filter((s) => s.session_id === session.id)
          .reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0);
        byDay[session.day_of_week] += dayVol;
      }
      if (!cancelled) setVolumes(byDay);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  return { volumes, reload };
}

// ---- Stale muscle alert (last trained per muscle group) ----
export interface MuscleStaleness {
  muscle: string;
  daysSinceTrained: number | null;
  lastTrainedDate: string | null;
}

export function useStaleMuscles(): { stale: MuscleStaleness[]; loading: boolean } {
  const [stale, setStale] = useState<MuscleStaleness[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const exercises = await db.exercises.toArray();
      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .toArray();
      const allSets = await db.session_sets.toArray();

      // Group by muscle
      const muscleLastTrained = new Map<string, string>();
      for (const set of allSets) {
        const ex = exercises.find((e) => e.id === set.exercise_id);
        if (!ex) continue;
        const muscle = ex.target_muscle;
        const session = sessions.find((s) => s.id === set.session_id);
        if (!session) continue;
        const existing = muscleLastTrained.get(muscle);
        if (!existing || session.started_at > existing) {
          muscleLastTrained.set(muscle, session.started_at);
        }
      }

      const now = Date.now();
      const result: MuscleStaleness[] = [];
      for (const [muscle, lastDate] of muscleLastTrained) {
        const days = Math.floor((now - new Date(lastDate).getTime()) / 86400000);
        result.push({
          muscle,
          daysSinceTrained: days,
          lastTrainedDate: lastDate,
        });
      }
      // Sort by most stale
      result.sort((a, b) => (b.daysSinceTrained ?? 0) - (a.daysSinceTrained ?? 0));
      if (!cancelled) {
        setStale(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  return { stale, loading, reload };
}
