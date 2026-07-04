"use client";
import { useState, useEffect, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import type { Biometric } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Frown, Meh, Smile, Battery, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn, uid } from "@/lib/utils";

export function RecoveryTracker() {
  const [todayLogs, setTodayLogs] = useState<Biometric[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDB();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const today = await db.biometrics
        .where("logged_at")
        .above(startOfDay.toISOString())
        .filter((b) =>
          ["sleep_hours", "soreness", "mood", "readiness"].includes(b.metric)
        )
        .toArray();
      if (!cancelled) setTodayLogs(today);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const logRecovery = async (
    metric: "sleep_hours" | "soreness" | "mood" | "readiness",
    value: number,
    unit: string
  ) => {
    const db = getDB();
    // Remove existing today's log for this metric
    const existing = todayLogs.find((l) => l.metric === metric);
    if (existing) {
      await db.biometrics.delete(existing.id);
    }
    const entry: Biometric = {
      id: uid("bio"),
      tier: 1,
      metric,
      value,
      unit,
      logged_at: new Date().toISOString(),
    };
    await db.biometrics.put(entry);
    reload();
    toast.success("Recovery logged");
  };

  const getValue = (metric: string) =>
    todayLogs.find((l) => l.metric === metric)?.value;

  const sleepValue = getValue("sleep_hours");
  const sorenessValue = getValue("soreness");
  const moodValue = getValue("mood");
  const readinessValue = getValue("readiness");

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Battery className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">Recovery Today</h3>
            <p className="text-xs text-muted-foreground">
              Log how you feel before training
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sleep */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-xs font-medium">Sleep</span>
              </div>
              {sleepValue !== undefined && (
                <span className="text-xs font-bold">
                  {sleepValue}h
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {[4, 5, 6, 7, 8, 9, 10].map((h) => (
                <Button
                  key={h}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 h-8 text-xs",
                    sleepValue === h &&
                      "bg-indigo-500/20 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  )}
                  onClick={() => logRecovery("sleep_hours", h, "hours")}
                >
                  {h}h
                </Button>
              ))}
            </div>
          </div>

          {/* Soreness */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">Soreness</span>
              {sorenessValue !== undefined && (
                <span className="text-xs font-bold">
                  {["None", "Mild", "Moderate", "High", "Severe"][sorenessValue - 1]}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 h-8 text-xs",
                    sorenessValue === s &&
                      "bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-400"
                  )}
                  onClick={() => logRecovery("soreness", s, "1-5")}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">Mood</span>
              {moodValue !== undefined && (
                <span className="text-xs font-bold">
                  {["Poor", "Low", "OK", "Good", "Great"][moodValue - 1]}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((m) => {
                const icons = [Frown, Frown, Meh, Smile, Smile];
                const Icon = icons[m - 1];
                return (
                  <Button
                    key={m}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 h-10",
                      moodValue === m &&
                        "bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400"
                    )}
                    onClick={() => logRecovery("mood", m, "1-5")}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Readiness */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">Readiness</span>
              {readinessValue !== undefined && (
                <span className="text-xs font-bold">
                  {["Drag", "Tired", "OK", "Fresh", "Pumped"][readinessValue - 1]}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 h-8 text-xs",
                    readinessValue === r &&
                      "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  )}
                  onClick={() => logRecovery("readiness", r, "1-5")}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
