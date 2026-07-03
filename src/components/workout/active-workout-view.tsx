"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useActiveSessionStore } from "@/lib/store/active-session-store";
import {
  useActiveVersion,
  useRoutineNodes,
  useDayLabels,
} from "@/hooks/use-routine";
import { startSessionForDay } from "@/lib/session-helpers";
import type { DayOfWeek } from "@/lib/types";
import { VisualTagBadge } from "@/components/routine/visual-tag-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Lock, Clock, Dumbbell, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export function ActiveWorkoutView() {
  const setView = useAppStore((s) => s.setView);
  const setSelectedDay = useAppStore((s) => s.setSelectedDay);
  const { version, loading } = useActiveVersion();
  const { nodes } = useRoutineNodes(version?.id);
  const { labels } = useDayLabels(version?.id);
  const [starting, setStarting] = useState<DayOfWeek | null>(null);
  const activeSession = useActiveSessionStore((s) => s.session);

  // If there's an active session, redirect to it
  useEffect(() => {
    if (activeSession) {
      setView("active_session");
    }
  }, [activeSession, setView]);

  const today = new Date().getDay() as DayOfWeek;
  const todayNodes = nodes.filter((n) => n.day_of_week === today);
  const exercises = todayNodes.filter((n) => n.block_type === "exercise");

  const startWorkout = async (day: DayOfWeek) => {
    setStarting(day);
    try {
      await startSessionForDay(day);
      toast.success("Session started — let's lift!");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to start session"
      );
    } finally {
      setStarting(null);
    }
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
              disabled={starting !== null}
              className="w-full gap-2 bg-background text-foreground hover:bg-background/90"
              size="lg"
            >
              {starting === today ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Start Workout
                </>
              )}
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
                disabled={starting !== null}
                className="w-full flex items-center justify-between rounded-xl border bg-card p-3 text-left hover:bg-accent/50 transition-colors disabled:opacity-50"
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
                  {starting === day && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Features notice */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">
                Active Workout HUD Features
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Oversized LOG SET / STATION BUSY / SKIP buttons</li>
                <li>Smart fallback: auto-swaps to alternatives when busy</li>
                <li>Rest timer pill with +/-15s adjustments</li>
                <li>Color-wave completion (no jarring full-screen alert)</li>
                <li>Plate-loading calculator for barbell exercises</li>
                <li>Survives screen lock (absolute timestamps)</li>
              </ul>
              <p className="mt-2">
                Configure haptics &amp; notification style in Profile → Preferences.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
