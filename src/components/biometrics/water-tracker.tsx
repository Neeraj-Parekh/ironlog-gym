"use client";
import { useWaterIntake, useWater24h, useBiometrics } from "@/hooks/use-biometrics";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Droplets, Plus, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function WaterTracker() {
  const { todayIntake, totalMl, addWater, removeWater } = useWaterIntake();
  const { data: graphData } = useWater24h();
  const { getLatest } = useBiometrics();
  const { waterGoalMl } = useSettingsStore();

  // Calculate dynamic goal: 35ml × bodyweight, or user-set override, or 2500 default
  const bodyweight = getLatest("body_weight");
  const DAILY_GOAL_ML =
    waterGoalMl > 0
      ? waterGoalMl
      : bodyweight
      ? Math.round(bodyweight.value * 35)
      : 2500;

  const goalProgress = Math.min(100, (totalMl / DAILY_GOAL_ML) * 100);
  const remaining = Math.max(0, DAILY_GOAL_ML - totalMl);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Hydration</h3>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{totalMl}</p>
            <p className="text-xs text-muted-foreground">ml / {DAILY_GOAL_ML}</p>
          </div>
        </div>

        {/* Progress ring / bar */}
        <div className="mb-4">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                goalProgress >= 100
                  ? "bg-emerald-500"
                  : "bg-sky-500"
              )}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            {goalProgress >= 100
              ? "Daily goal reached! 💧"
              : `${remaining} ml to go`}
          </p>
        </div>

        {/* Quick add buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[250, 500, 750, 1000].map((amount) => (
            <Button
              key={amount}
              variant="outline"
              onClick={() => addWater(amount)}
              className="flex flex-col items-center gap-0.5 h-auto py-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">{amount}</span>
              <span className="text-[9px] text-muted-foreground">ml</span>
            </Button>
          ))}
        </div>

        {/* 24h graph */}
        {graphData.length > 0 ? (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                24-hour intake
              </span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData}>
                  <defs>
                    <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9 }}
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 9 }}
                    className="text-muted-foreground"
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} ml`, "Cumulative"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#waterGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 mb-4">
            No water logged yet today. Tap a button above to start tracking.
          </p>
        )}

        {/* Today's entries */}
        {todayIntake.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Today&apos;s log
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {[...todayIntake].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Droplets className="h-3 w-3 text-sky-500" />
                    <span className="text-sm font-medium">{entry.amount_ml} ml</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.logged_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => removeWater(entry.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
