"use client";
import { useAppStore } from "@/lib/store/app-store";
import {
  useActiveVersion,
  useRoutineNodes,
  useDayLabels,
} from "@/hooks/use-routine";
import { useWeeklyVolume, useStaleMuscles } from "@/hooks/use-weekly-volume";
import { DayCell } from "./day-card";
import type { DayOfWeek, RoutineNode } from "@/lib/types";
import { CalendarDays, AlertCircle, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun

// Volume → heatmap color
function getVolumeColor(volume: number, maxVol: number): string {
  if (volume === 0) return "transparent";
  const ratio = volume / maxVol;
  if (ratio > 0.75) return "bg-emerald-500";
  if (ratio > 0.5) return "bg-emerald-400";
  if (ratio > 0.25) return "bg-lime-400";
  return "bg-amber-400";
}

export function WeekView() {
  const openDayEditor = useAppStore((s) => s.openDayEditor);
  const { version, loading: vLoading } = useActiveVersion();
  const { nodes, loading: nLoading } = useRoutineNodes(version?.id);
  const { labels } = useDayLabels(version?.id);
  const { volumes } = useWeeklyVolume();
  const { stale } = useStaleMuscles();

  if (vLoading || nLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="h-8 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
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

  const maxVol = Math.max(...Object.values(volumes), 1);

  // Stale muscles (7+ days)
  const staleMuscles = stale.filter((s) => (s.daysSinceTrained ?? 0) >= 7).slice(0, 3);

  const today = new Date().getDay();

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>
          {version?.label} · Week {version?.effective_week}
        </span>
      </div>

      {/* Stale muscle alerts */}
      {staleMuscles.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
              Stale Muscle Alert
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {staleMuscles.map((s) => (
              <span
                key={s.muscle}
                className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs capitalize text-amber-700 dark:text-amber-400"
              >
                {s.muscle} · {s.daysSinceTrained}d
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Week calendar grid — 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {DAYS.map((day) => {
          const dayNodes = byDay.get(day) ?? [];
          const exercises = dayNodes.filter((n) => n.block_type === "exercise");
          const volume = volumes[day] ?? 0;
          const isToday = day === today;

          return (
            <button
              key={day}
              onClick={() => openDayEditor(day)}
              className={cn(
                "relative overflow-hidden rounded-2xl border bg-card p-3 text-left transition-all",
                "hover:border-foreground/20 hover:shadow-md active:scale-[0.98]",
                isToday && "ring-2 ring-foreground"
              )}
            >
              {/* Volume heatmap bar */}
              {volume > 0 && (
                <div
                  className={cn(
                    "absolute top-0 left-0 h-1 w-full transition-all",
                    getVolumeColor(volume, maxVol)
                  )}
                />
              )}

              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
                  </p>
                  <p className="font-bold text-sm leading-tight mt-0.5">
                    {labels[day]}
                  </p>
                </div>
                {isToday && (
                  <span className="text-[9px] font-bold uppercase bg-foreground text-background px-1.5 py-0.5 rounded">
                    Today
                  </span>
                )}
              </div>

              {/* Exercise count */}
              <div className="flex items-center gap-1.5 mb-2">
                {exercises.length > 0 ? (
                  <>
                    <div className="flex -space-x-1">
                      {exercises.slice(0, 3).map((ex) => {
                        const colors: Record<string, string> = {
                          machine: "bg-red-500",
                          "non-machine": "bg-emerald-500",
                          cardio: "bg-blue-500",
                          stretching: "bg-amber-500",
                        };
                        return (
                          <div
                            key={ex.id}
                            className={cn(
                              "h-2 w-2 rounded-full ring-1 ring-card",
                              colors[ex.exercise_type] ?? "bg-muted"
                            )}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {exercises.length}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/50">Rest day</span>
                )}
              </div>

              {/* Volume display */}
              {volume > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Flame className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{volume.toLocaleString()}kg</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span>Machine</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Free Weight</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <span>Cardio</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Stretch</span>
        </div>
      </div>
    </div>
  );
}
