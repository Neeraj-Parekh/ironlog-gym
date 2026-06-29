"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type {
  Biometric,
  WaterIntake,
  BiometricMetric,
  BiometricTier,
} from "@/lib/types";

// ---- Water intake ----
export function useWaterIntake() {
  const [todayIntake, setTodayIntake] = useState<WaterIntake[]>([]);
  const [totalMl, setTotalMl] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const today = await db.water_intake
        .where("logged_at")
        .above(startOfDay.toISOString())
        .toArray();
      if (!cancelled) {
        setTodayIntake(today.sort((a, b) => a.logged_at.localeCompare(b.logged_at)));
        setTotalMl(today.reduce((sum, w) => sum + w.amount_ml, 0));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const addWater = useCallback(async (amountMl: number) => {
    const db = getDB();
    const entry: WaterIntake = {
      id: `water_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount_ml: amountMl,
      logged_at: new Date().toISOString(),
    };
    await db.water_intake.put(entry);
    setReloadTick((t) => t + 1);
  }, []);

  const removeWater = useCallback(async (id: string) => {
    const db = getDB();
    await db.water_intake.delete(id);
    setReloadTick((t) => t + 1);
  }, []);

  return { todayIntake, totalMl, addWater, removeWater, reload };
}

// ---- 24h water history (for graph) ----
export function useWater24h() {
  const [data, setData] = useState<Array<{ time: string; ml: number; cumulative: number }>>([]);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const now = Date.now();
      const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const entries = await db.water_intake
        .where("logged_at")
        .above(cutoff)
        .toArray();
      entries.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      let cumulative = 0;
      const graphData = entries.map((e) => {
        cumulative += e.amount_ml;
        return {
          time: new Date(e.logged_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          ml: e.amount_ml,
          cumulative,
        };
      });
      if (!cancelled) setData(graphData);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { data, reload };
}

// ---- Biometrics ----
export function useBiometrics() {
  const [biometrics, setBiometrics] = useState<Biometric[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const all = await db.biometrics.orderBy("logged_at").reverse().toArray();
      if (!cancelled) setBiometrics(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const addBiometric = useCallback(
    async (
      tier: BiometricTier,
      metric: BiometricMetric,
      value: number,
      unit: string
    ) => {
      const db = getDB();
      const entry: Biometric = {
        id: `bio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tier,
        metric,
        value,
        unit,
        logged_at: new Date().toISOString(),
      };
      await db.biometrics.put(entry);
      setReloadTick((t) => t + 1);
    },
    []
  );

  // Get the most recent value for a metric
  const getLatest = useCallback(
    (metric: BiometricMetric): Biometric | null => {
      return biometrics.find((b) => b.metric === metric) ?? null;
    },
    [biometrics]
  );

  // Get all entries for a specific metric
  const getHistory = useCallback(
    (metric: BiometricMetric): Biometric[] => {
      return biometrics.filter((b) => b.metric === metric);
    },
    [biometrics]
  );

  // Days since last log for a metric
  const daysSince = useCallback(
    (metric: BiometricMetric): number | null => {
      const latest = getLatest(metric);
      if (!latest) return null;
      const diff = Date.now() - new Date(latest.logged_at).getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    },
    [getLatest]
  );

  return {
    biometrics,
    addBiometric,
    getLatest,
    getHistory,
    daysSince,
    reload,
  };
}
