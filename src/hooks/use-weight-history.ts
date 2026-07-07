"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type { Biometric } from "@/lib/types";

// ---- Weight history with BMI ----
export function useWeightHistory() {
  const [weights, setWeights] = useState<Array<{ date: string; value: number; bmi: number | null }>>([]);
  const [latestWeight, setLatestWeight] = useState<Biometric | null>(null);
  const [latestHeight, setLatestHeight] = useState<Biometric | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const weightLogs = await db.biometrics
        .where("metric")
        .equals("body_weight")
        .sortBy("logged_at");
      const heightLog = await db.biometrics
        .where("metric")
        .equals("height")
        .reverse()
        .sortBy("logged_at")
        .then((arr) => arr[0] ?? null);

      const heightCm = heightLog?.value ?? null;
      const heightM = heightCm ? heightCm / 100 : null;

      const weightData = weightLogs.map((w) => ({
        date: w.logged_at.slice(0, 10),
        value: w.value,
        bmi: heightM ? w.value / (heightM * heightM) : null,
      }));

      if (!cancelled) {
        setWeights(weightData);
        setLatestWeight(weightLogs[weightLogs.length - 1] ?? null);
        setLatestHeight(heightLog);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  return { weights, latestWeight, latestHeight, loading, reload };
}

// ---- BMI color + label ----
export function getBMIColor(bmi: number): { color: string; label: string; position: number } {
  if (bmi < 18.5) return { color: "#3b82f6", label: "Underweight", position: Math.max(0, (bmi / 18.5) * 25) };
  if (bmi < 25) return { color: "#10b981", label: "Healthy", position: 25 + ((bmi - 18.5) / 6.5) * 25 };
  if (bmi < 30) return { color: "#f59e0b", label: "Overweight", position: 50 + ((bmi - 25) / 5) * 25 };
  if (bmi < 35) return { color: "#f97316", label: "Obese I", position: 75 + ((bmi - 30) / 5) * 12.5 };
  return { color: "#ef4444", label: "Obese II+", position: Math.min(100, 87.5 + ((bmi - 35) / 5) * 12.5) };
}

// ---- Monthly workout calendar ----
export function useMonthlyCalendar(year: number, month: number) {
  const [days, setDays] = useState<Array<{ date: string; volume: number; sessionCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;

      const sessions = await db.sessions
        .where("status")
        .equals("completed" as never)
        .filter((s) => s.date >= monthStart && s.date <= monthEnd)
        .toArray();

      const allSets = await db.session_sets.toArray();

      const byDate = new Map<string, { volume: number; sessionCount: number }>();
      for (const session of sessions) {
        const sets = allSets.filter((s) => s.session_id === session.id);
        const vol = sets.reduce((sum, s) => sum + s.weight_kg * s.reps_completed, 0);
        const existing = byDate.get(session.date);
        if (existing) {
          existing.volume += vol;
          existing.sessionCount += 1;
        } else {
          byDate.set(session.date, { volume: vol, sessionCount: 1 });
        }
      }

      if (!cancelled) {
        setDays(Array.from(byDate.entries()).map(([date, data]) => ({ date, ...data })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [year, month, reloadTick]);

  return { days, loading, reload };
}
