"use client";
import { useAppStore } from "@/lib/store/app-store";
import {
  useActiveVersion,
  useRoutineNodes,
  useDayLabels,
} from "@/hooks/use-routine";
import { DayCard } from "./day-card";
import type { DayOfWeek, RoutineNode } from "@/lib/types";
import { CalendarDays, Loader2 } from "lucide-react";

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun (week starts Monday)

export function WeekView() {
  const openDayEditor = useAppStore((s) => s.openDayEditor);
  const { version, loading: vLoading } = useActiveVersion();
  const { nodes, loading: nLoading } = useRoutineNodes(version?.id);
  const { labels } = useDayLabels(version?.id);

  if (vLoading || nLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Group nodes by day
  const byDay = new Map<DayOfWeek, RoutineNode[]>();
  for (const d of DAYS) byDay.set(d, []);
  for (const node of nodes) {
    const arr = byDay.get(node.day_of_week);
    if (arr) arr.push(node);
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>
          {version?.label} · Week {version?.effective_week}
        </span>
      </div>

      <div className="grid gap-3">
        {DAYS.map((day) => (
          <DayCard
            key={day}
            day={day}
            label={labels[day]}
            nodes={byDay.get(day) ?? []}
            onClick={() => openDayEditor(day)}
          />
        ))}
      </div>
    </div>
  );
}
