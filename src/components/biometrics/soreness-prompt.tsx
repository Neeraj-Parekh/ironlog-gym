"use client";
import { useState } from "react";
import { useSessionsNeedingSoreness } from "@/hooks/use-vitality";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Flame, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MuscleSorenessEntry } from "@/lib/types";

const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "traps",
  "forearms",
];

const LEVEL_CONFIG: Array<{
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
}> = [
  { level: 1, label: "None", color: "#10b981" },
  { level: 2, label: "Mild", color: "#84cc16" },
  { level: 3, label: "Moderate", color: "#f59e0b" },
  { level: 4, label: "High", color: "#f97316" },
  { level: 5, label: "Severe", color: "#ef4444" },
];

export function SorenessPrompt() {
  const { sessions, logSoreness } = useSessionsNeedingSoreness();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overall, setOverall] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [muscleEntries, setMuscleEntries] = useState<MuscleSorenessEntry[]>([]);
  const [showPerMuscle, setShowPerMuscle] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (sessions.length === 0) return null;

  // Filter out dismissed sessions
  const active = sessions.filter((s) => !dismissed.has(s.session.id));
  if (active.length === 0) return null;

  const current = active[0];

  const handleLog = async () => {
    await logSoreness(
      current.session.id,
      overall,
      muscleEntries,
      current.hoursAgo
    );
    toast.success("Soreness logged");
    setDismissed((prev) => new Set(prev).add(current.session.id));
    setExpanded(null);
    setOverall(2);
    setMuscleEntries([]);
    setShowPerMuscle(false);
  };

  const handleDismiss = () => {
    setDismissed((prev) => new Set(prev).add(current.session.id));
  };

  const toggleMuscle = (muscle: string, level: 1 | 2 | 3 | 4 | 5) => {
    setMuscleEntries((prev) => {
      const existing = prev.find((e) => e.muscle === muscle);
      if (existing) {
        if (existing.level === level) {
          // Same level → remove
          return prev.filter((e) => e.muscle !== muscle);
        }
        return prev.map((e) => (e.muscle === muscle ? { ...e, level } : e));
      }
      return [...prev, { muscle, level }];
    });
  };

  const getMuscleLevel = (muscle: string): number | null => {
    const entry = muscleEntries.find((e) => e.muscle === muscle);
    return entry?.level ?? null;
  };

  return (
    <>
      {/* Prompt card */}
      <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-500/5 to-transparent">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500 shrink-0">
              <Flame className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">
                How sore from {current.session.day_label}?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {current.hoursAgo}h after session ·{" "}
                {new Date(current.session.started_at).toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Button
            size="sm"
            className="w-full mt-3 gap-1.5"
            onClick={() => setExpanded(current.session.id)}
          >
            <Flame className="h-3.5 w-3.5" />
            Log Soreness
          </Button>
        </CardContent>
      </Card>

      {/* Soreness input sheet */}
      <Sheet
        open={expanded !== null}
        onOpenChange={(v) => !v && setExpanded(null)}
      >
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Post-Workout Soreness
            </SheetTitle>
            <SheetDescription>
              {current.session.day_label} · {current.hoursAgo}h ago
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-4">
            {/* Overall rating */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Overall soreness
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {LEVEL_CONFIG.map(({ level, label, color }) => (
                  <button
                    key={level}
                    onClick={() => setOverall(level)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all",
                      overall === level
                        ? "scale-105"
                        : "border-border opacity-60"
                    )}
                    style={
                      overall === level
                        ? {
                            borderColor: color,
                            backgroundColor: `${color}15`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Per-muscle toggle */}
            <button
              onClick={() => setShowPerMuscle(!showPerMuscle)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              {showPerMuscle ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showPerMuscle ? "Hide" : "Show"} per-muscle breakdown
            </button>

            {/* Per-muscle heatmap */}
            {showPerMuscle && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Muscle-specific soreness
                </label>
                <p className="text-xs text-muted-foreground">
                  Tap a level for each muscle you trained
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MUSCLE_GROUPS.map((muscle) => {
                    const level = getMuscleLevel(muscle);
                    return (
                      <div
                        key={muscle}
                        className="rounded-lg border p-2"
                        style={
                          level
                            ? {
                                borderColor: LEVEL_CONFIG[level - 1].color,
                                backgroundColor: `${LEVEL_CONFIG[level - 1].color}10`,
                              }
                            : undefined
                        }
                      >
                        <p className="text-xs font-medium capitalize mb-1.5">
                          {muscle}
                        </p>
                        <div className="flex gap-1">
                          {LEVEL_CONFIG.map(({ level: lvl, color }) => (
                            <button
                              key={lvl}
                              onClick={() => toggleMuscle(muscle, lvl)}
                              className={cn(
                                "h-5 flex-1 rounded transition-all",
                                level === lvl
                                  ? "scale-110"
                                  : "opacity-30 hover:opacity-60"
                              )}
                              style={{ backgroundColor: color }}
                              aria-label={`${muscle} ${LEVEL_CONFIG[lvl - 1].label}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              className="w-full gap-1.5"
              size="lg"
              onClick={handleLog}
            >
              <Flame className="h-4 w-4" />
              Log Soreness
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
