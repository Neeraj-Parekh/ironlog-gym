"use client";
import { useAppStore } from "@/lib/store/app-store";
import {
  useActiveVersion,
  useRoutineNodes,
  useDayLabels,
} from "@/hooks/use-routine";
import type { DayOfWeek, RoutineNode } from "@/lib/types";
import { VisualTagBadge } from "@/components/routine/visual-tag-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Lock, Clock, Dumbbell } from "lucide-react";

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export function ActiveWorkoutView() {
  const setView = useAppStore((s) => s.setView);
  const setSelectedDay = useAppStore((s) => s.setSelectedDay);
  const { version, loading } = useActiveVersion();
  const { nodes } = useRoutineNodes(version?.id);
  const { labels } = useDayLabels(version?.id);

  const today = new Date().getDay() as DayOfWeek;
  const todayNodes = nodes.filter((n) => n.day_of_week === today);
  const exercises = todayNodes.filter((n) => n.block_type === "exercise");

  const startWorkout = (day: DayOfWeek) => {
    setSelectedDay(day);
    // Phase 2 will launch the HUD here
    toast("Active Workout HUD coming in Phase 2 — stay tuned!");
  };

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <Card className="border-foreground/20 bg-foreground text-background">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/15">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Today&apos;s Session</h2>
              <p className="text-sm text-background/70">
                {labels[today]} · {exercises.length} exercises queued
              </p>
            </div>
          </div>
          {exercises.length > 0 ? (
            <Button
              onClick={() => startWorkout(today)}
              className="w-full gap-2 bg-background text-foreground hover:bg-background/90"
              size="lg"
            >
              <Play className="h-5 w-5" />
              Start Workout
            </Button>
          ) : (
            <p className="text-sm text-background/70 text-center py-2">
              No exercises scheduled for today. Add some via the Routine tab.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quick Start — Other Days
        </h3>
        <div className="space-y-2">
          {DAYS.filter((d) => d !== today).map((day) => {
            const dayNodes = nodes.filter((n) => n.day_of_week === day);
            const dayExercises = dayNodes.filter(
              (n) => n.block_type === "exercise"
            );
            if (dayExercises.length === 0) return null;
            return (
              <button
                key={day}
                onClick={() => startWorkout(day)}
                className="w-full flex items-center justify-between rounded-xl border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{labels[day]}</p>
                  <p className="text-xs text-muted-foreground">
                    {dayExercises.length} exercises
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {dayExercises.slice(0, 3).map((ex) => (
                    <VisualTagBadge key={ex.id} type={ex.exercise_type} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Coming soon notice */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4 pb-4 flex items-start gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Phase 2 — Active Workout HUD
            </p>
            <p>
              Oversized LOG SET / STATION BUSY / SKIP buttons, smart fallback
              state machine, background-proof rest timer, and plate-loading
              calculator. Coming next.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Inline toast import (sonner) — keeps the stub self-contained
import { toast } from "sonner";
