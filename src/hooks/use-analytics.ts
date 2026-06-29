"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type { Session, SessionSet, Exercise } from "@/lib/types";

export interface SessionWithSets {
  session: Session;
  sets: SessionSet[];
}

// ---- Load all completed sessions with their sets ----
export function useSessions() {
  const [sessions, setSessions] = useState<SessionWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const allSessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .reverse()
        .sortBy("started_at");

      const result: SessionWithSets[] = [];
      for (const session of allSessions) {
        const sets = await db.session_sets
          .where("session_id")
          .equals(session.id)
          .toArray();
        result.push({ session, sets });
      }

      if (!cancelled) {
        setSessions(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { sessions, loading, reload };
}

// ---- Load all exercises (for the trend picker) ----
export function useAllExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const result = await db.exercises.orderBy("name").toArray();
      if (!cancelled) {
        setExercises(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { exercises, loading, reload };
}

// ---- Get exercises that have been logged at least once ----
export function useLoggedExercises() {
  const { sessions } = useSessions();
  const { exercises } = useAllExercises();

  const loggedExerciseIds = new Set<string>();
  for (const { sets } of sessions) {
    for (const s of sets) {
      if (s.exercise_id) loggedExerciseIds.add(s.exercise_id);
    }
  }

  return exercises.filter((e) => loggedExerciseIds.has(e.id));
}
