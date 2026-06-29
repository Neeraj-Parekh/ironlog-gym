"use client";
import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type {
  RoutineVersion,
  RoutineNode,
  DayLabel,
  Exercise,
  Equipment,
  DayOfWeek,
} from "@/lib/types";

// ---- Load active routine version ----
export function useActiveVersion() {
  const [version, setVersion] = useState<RoutineVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const v = await db.routine_versions
        .where("is_active")
        .equals(1 as never)
        .first();
      const active =
        v ?? (await db.routine_versions.orderBy("created_at").reverse().first());
      if (!cancelled) {
        setVersion(active ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { version, loading, reload };
}

// ---- Load all routine nodes for a version ----
export function useRoutineNodes(versionId: string | undefined) {
  const [nodes, setNodes] = useState<RoutineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!versionId) {
        setNodes([]);
        setLoading(false);
        return;
      }
      const db = getDB();
      const result = await db.routine_nodes
        .where("version_id")
        .equals(versionId)
        .toArray();
      result.sort((a, b) => {
        if (a.day_of_week !== b.day_of_week)
          return a.day_of_week - b.day_of_week;
        const order = { pre: 0, exercise: 1, post: 2 };
        if (a.block_type !== b.block_type)
          return order[a.block_type] - order[b.block_type];
        return a.sequence_order - b.sequence_order;
      });
      if (!cancelled) {
        setNodes(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionId, reloadTick]);

  return { nodes, loading, reload };
}

// ---- Load day labels for a version ----
export function useDayLabels(versionId: string | undefined) {
  const [labels, setLabels] = useState<Record<DayOfWeek, string>>({
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  });
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!versionId) {
        setLoading(false);
        return;
      }
      const db = getDB();
      const result = await db.day_labels
        .where("version_id")
        .equals(versionId)
        .toArray();
      if (!cancelled) {
        setLabels((prev) => {
          const map = { ...prev };
          for (const lbl of result) {
            if (lbl.is_active) map[lbl.day_of_week] = lbl.label;
          }
          return map;
        });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionId, reloadTick]);

  return { labels, loading, reload };
}

// ---- Load all exercises ----
export function useExercises() {
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

// ---- Load all equipment ----
export function useEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const result = await db.equipment.orderBy("name").toArray();
      if (!cancelled) {
        setEquipment(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { equipment, loading, reload };
}
