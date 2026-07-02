"use client";
import { useState } from "react";
import { usePreWorkoutContext } from "@/hooks/use-vitality";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Coffee, Utensils, Brain, Droplets, Clock, Sunrise, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

const CAFFEINE_PRESETS = [0, 100, 200, 300];
const MEAL_PRESETS = [0.5, 1, 2, 3, 4];
const STRESS_LABELS = ["Chill", "Easy", "OK", "Tense", "Stressed"];

export function PreWorkoutContextCard({
  sessionId,
  hydrationMl,
}: {
  sessionId: string | null;
  hydrationMl: number;
}) {
  const { context, saveContext } = usePreWorkoutContext(sessionId);
  const [open, setOpen] = useState(false);
  const [hoursSinceMeal, setHoursSinceMeal] = useState(2);
  const [caffeineMg, setCaffeineMg] = useState(0);
  const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(2);

  // Auto-capture time + waking
  const [timeOfDay] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  const [hoursSinceWaking, setHoursSinceWaking] = useState(() => {
    // Compute on initial render (no effect needed)
    const stored = typeof window !== "undefined" ? localStorage.getItem("ironlog-wake-time") : null;
    if (stored) {
      const wakeTime = new Date(stored);
      const hours = Math.max(0, Math.round((Date.now() - wakeTime.getTime()) / 3600000));
      return Math.min(16, hours);
    }
    // First open today — store it as wake time
    if (typeof window !== "undefined") {
      localStorage.setItem("ironlog-wake-time", new Date().toISOString());
    }
    return 0;
  });

  const handleSave = async () => {
    await saveContext({
      session_id: sessionId ?? "",
      logged_at: new Date().toISOString(),
      time_of_day: timeOfDay,
      hours_since_waking: hoursSinceWaking,
      hours_since_last_meal: hoursSinceMeal,
      caffeine_mg: caffeineMg,
      stress_level: stressLevel,
      hydration_ml: hydrationMl,
    });
    haptic("success");
    toast.success("Pre-workout context saved");
    setOpen(false);
  };

  // Display summary if context exists
  const displayContext = context ?? null;
  const summary = displayContext
    ? [
        `${displayContext.hours_since_waking}h awake`,
        displayContext.hours_since_last_meal < 1
          ? "fasted"
          : `${displayContext.hours_since_last_meal}h fed`,
        displayContext.caffeine_mg > 0
          ? `${displayContext.caffeine_mg}mg caf`
          : "no caf",
        STRESS_LABELS[displayContext.stress_level - 1],
      ].join(" · ")
    : null;

  return (
    <>
      <Card
        className={cn(
          "cursor-pointer transition-all",
          !displayContext && "border-dashed"
        )}
        onClick={() => setOpen(true)}
      >
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">Pre-Workout State</h3>
              {displayContext && (
                <span className="text-[9px] font-bold uppercase bg-violet-500/20 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded">
                  Logged
                </span>
              )}
            </div>
            {summary ? (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {summary}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap to log your pre-workout state
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-500" />
              Pre-Workout Context
            </SheetTitle>
            <SheetDescription>
              Your physiological state affects performance
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-4">
            {/* Auto-captured */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Time</span>
                </div>
                <p className="font-bold text-lg tabular-nums">{timeOfDay}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Sunrise className="h-3.5 w-3.5" />
                  <span className="text-xs">Awake</span>
                </div>
                <p className="font-bold text-lg tabular-nums">
                  {hoursSinceWaking}h
                </p>
              </div>
            </div>

            {/* Hours since meal */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Utensils className="h-4 w-4" />
                Hours since last meal
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {MEAL_PRESETS.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setHoursSinceMeal(h);
                      haptic("select");
                    }}
                    className={cn(
                      "h-10 rounded-lg border-2 font-bold text-sm transition-all",
                      hoursSinceMeal === h
                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                        : "border-border"
                    )}
                  >
                    {h < 1 ? "0.5h" : `${h}h`}
                  </button>
                ))}
              </div>
              {hoursSinceMeal >= 3 && (
                <p className="text-xs text-amber-500 mt-1.5">
                  Training fasted — lower intensity may be expected
                </p>
              )}
            </div>

            {/* Caffeine */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Coffee className="h-4 w-4" />
                Caffeine intake
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {CAFFEINE_PRESETS.map((mg) => (
                  <button
                    key={mg}
                    onClick={() => {
                      setCaffeineMg(mg);
                      haptic("select");
                    }}
                    className={cn(
                      "h-10 rounded-lg border-2 font-bold text-sm transition-all",
                      caffeineMg === mg
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-border"
                    )}
                  >
                    {mg === 0 ? "None" : `${mg}mg`}
                  </button>
                ))}
              </div>
            </div>

            {/* Stress */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Brain className="h-4 w-4" />
                Stress level
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStressLevel(s as 1 | 2 | 3 | 4 | 5);
                      haptic("select");
                    }}
                    className={cn(
                      "h-10 rounded-lg border-2 text-xs font-medium transition-all",
                      stressLevel === s
                        ? s <= 2
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : s === 3
                          ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "border-border"
                    )}
                  >
                    {STRESS_LABELS[s - 1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Hydration (pulled from tracker) */}
            <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-3">
              <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 mb-1">
                <Droplets className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Hydration today</span>
              </div>
              <p className="font-bold text-lg">{hydrationMl} ml</p>
              <p className="text-[10px] text-muted-foreground">Auto-pulled from water tracker</p>
            </div>

            <Button className="w-full gap-1.5" size="lg" onClick={handleSave}>
              <Zap className="h-4 w-4" />
              Save Context
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
