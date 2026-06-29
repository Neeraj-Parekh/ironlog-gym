"use client";
import { useEffect, useState } from "react";
import { getDB } from "@/lib/dexie";
import type { PersonalRecord, Milestone, StreakRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function AchievementsPanel() {
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [streak, setStreak] = useState<StreakRecord | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const [p, m, s] = await Promise.all([
        db.personal_records.orderBy("achieved_at").reverse().toArray(),
        db.milestones.orderBy("achieved_at").reverse().toArray(),
        db.streak.toArray(),
      ]);
      if (!cancelled) {
        setPrs(p);
        setMilestones(m);
        setStreak(s[0] ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return (
    <div className="space-y-3">
      {/* Streak card */}
      {streak && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500">
                  <Flame className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">
                    {streak.current_streak}
                  </p>
                  <p className="text-xs text-muted-foreground">day streak</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Longest</p>
                <p className="font-bold">{streak.longest_streak} days</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* PRs */}
      {prs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Personal Records
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {prs.slice(0, 10).map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {pr.exercise_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(pr.achieved_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">
                      {pr.weight_kg}kg × {pr.reps}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      1RM: {pr.estimated_1rm.toFixed(1)}kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-violet-500" />
              Milestones ({milestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2">
              {milestones.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border bg-muted/30 p-2 text-center"
                >
                  <Star className="h-4 w-4 text-violet-500 mx-auto mb-1" />
                  <p className="text-xs font-bold leading-tight">{m.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {new Date(m.achieved_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
