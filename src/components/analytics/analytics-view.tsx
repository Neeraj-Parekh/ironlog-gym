"use client";
import { useState } from "react";
import { useSessions, useLoggedExercises } from "@/hooks/use-analytics";
import {
  buildExerciseTrend,
  computeProgressiveOverload,
  summarizeSession,
  estimate1RM,
  type ExerciseTrendPoint,
} from "@/lib/analytics";
import { deleteSession } from "@/lib/session-helpers";
import { AchievementsPanel } from "./achievements-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Dumbbell,
  Calendar,
  Trophy,
  Zap,
  Activity,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AnalyticsView() {
  const { sessions, loading, reload } = useSessions();
  const loggedExercises = useLoggedExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSession(deleteTarget);
      toast.success("Session deleted");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="px-4 py-4 pb-24">
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="font-bold text-lg mb-1">No Sessions Yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Complete a workout from the Workout tab to start building your
              analytics. Volume trends, 1RM estimates, and progressive overload
              velocity will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Aggregate stats ----
  const totalVolume = sessions.reduce(
    (sum, { session, sets }) => sum + summarizeSession(session, sets).totalVolume,
    0
  );
  const totalSets = sessions.reduce(
    (sum, { sets }) => sum + sets.length,
    0
  );
  const totalSessions = sessions.length;
  const allTimeBest1RM = Math.max(
    ...sessions.flatMap(({ sets }) =>
      sets.map((s) => estimate1RM(s.weight_kg, s.reps_completed))
    )
  );

  // Weekly aggregate (last 8 weeks)
  const weeklyData = buildWeeklyAggregate(sessions);

  // Exercise trend
  const exerciseTrend = selectedExerciseId
    ? buildExerciseTrend(
        selectedExerciseId,
        sessions.map((s) => ({ session: s.session, sets: s.sets }))
      )
    : [];
  const progressiveOverload = computeProgressiveOverload(
    exerciseTrend.map((p) => p.best1RM)
  );

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Calendar}
          label="Sessions"
          value={String(totalSessions)}
          accent="text-emerald-500 bg-emerald-500/10"
        />
        <StatCard
          icon={Dumbbell}
          label="Total Sets"
          value={String(totalSets)}
          accent="text-sky-500 bg-sky-500/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Volume"
          value={`${(totalVolume / 1000).toFixed(1)}k kg`}
          accent="text-amber-500 bg-amber-500/10"
        />
        <StatCard
          icon={Trophy}
          label="Best 1RM"
          value={`${allTimeBest1RM.toFixed(1)} kg`}
          accent="text-rose-500 bg-rose-500/10"
        />
      </div>

      <Tabs defaultValue="weekly">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="exercise">Exercise</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Weekly aggregate */}
        <TabsContent value="weekly" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Weekly Volume (last 8 weeks)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: "12px",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} kg`, "Volume"]}
                    />
                    <Bar
                      dataKey="volume"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per-exercise trend */}
        <TabsContent value="exercise" className="space-y-3 mt-3">
          <Card>
            <CardContent className="pt-4">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Select exercise
              </label>
              <Select
                value={selectedExerciseId}
                onValueChange={setSelectedExerciseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exercise to view trends..." />
                </SelectTrigger>
                <SelectContent>
                  {loggedExercises.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedExerciseId && exerciseTrend.length > 0 && (
            <>
              {/* Progressive overload indicator */}
              {progressiveOverload && (
                <ProgressiveOverloadCard result={progressiveOverload} />
              )}

              {/* Volume trend */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Volume Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={exerciseTrend}>
                        <defs>
                          <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9 }}
                          className="text-muted-foreground"
                          tickFormatter={(v) => v.slice(5)}
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          className="text-muted-foreground"
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                          formatter={(value: number) => [`${value} kg`, "Volume"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="volume"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          fill="url(#volGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Estimated 1RM trend */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Estimated 1RM (Epley)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={exerciseTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9 }}
                          className="text-muted-foreground"
                          tickFormatter={(v) => v.slice(5)}
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          className="text-muted-foreground"
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                          formatter={(value: number) => [`${value.toFixed(1)} kg`, "Est. 1RM"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="best1RM"
                          stroke="var(--chart-2)"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "var(--chart-2)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {selectedExerciseId && exerciseTrend.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                No data for this exercise yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Session history */}
        <TabsContent value="history" className="space-y-3 mt-3">
          {/* Achievements at top of history */}
          <AchievementsPanel />

          {sessions.map(({ session, sets }) => {
            const summary = summarizeSession(session, sets);
            return (
              <Card key={session.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-sm">{session.day_label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.started_at).toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {new Date(session.started_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {summary.durationMinutes !== null && (
                        <span className="text-xs text-muted-foreground">
                          {summary.durationMinutes} min
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(session.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Volume
                      </p>
                      <p className="font-bold text-sm">
                        {summary.totalVolume.toLocaleString()} kg
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Sets
                      </p>
                      <p className="font-bold text-sm">{summary.totalSets}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Best 1RM
                      </p>
                      <p className="font-bold text-sm">
                        {summary.best1RM.toFixed(1)} kg
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Delete session confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the session and all its logged sets.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Helper components ----
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg mb-2", accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function ProgressiveOverloadCard({
  result,
}: {
  result: NonNullable<ReturnType<typeof computeProgressiveOverload>>;
}) {
  const config = {
    growth: {
      icon: TrendingUp,
      label: "Progressive Overload",
      color: "text-emerald-500 bg-emerald-500/10",
      message: "You're making gains!",
    },
    plateau: {
      icon: Minus,
      label: "Plateau Detected",
      color: "text-amber-500 bg-amber-500/10",
      message: "Consider deloading or varying rep ranges.",
    },
    regression: {
      icon: TrendingDown,
      label: "Regression",
      color: "text-rose-500 bg-rose-500/10",
      message: "Check recovery, sleep, and nutrition.",
    },
  }[result.status];

  const Icon = config.icon;

  return (
    <Card className={cn("border-l-4", result.status === "growth" && "border-l-emerald-500", result.status === "plateau" && "border-l-amber-500", result.status === "regression" && "border-l-rose-500")}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", config.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.message}</p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                result.velocity > 0 && "text-emerald-500",
                result.velocity < 0 && "text-rose-500",
                result.velocity === 0 && "text-amber-500"
              )}
            >
              {result.velocity > 0 ? "+" : ""}
              {result.velocity.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">vs prior 3</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Build weekly aggregate (last 8 weeks) ----
function buildWeeklyAggregate(
  sessions: Array<{ session: Session; sets: SessionSet[] }>
): Array<{ week: string; volume: number; sessions: number }> {
  const now = new Date();
  const weeks: Array<{ week: string; volume: number; sessions: number }> = [];

  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    })}`;

    let volume = 0;
    let sessionCount = 0;
    for (const { session, sets } of sessions) {
      const sessionDate = new Date(session.started_at);
      if (sessionDate >= weekStart && sessionDate < weekEnd) {
        volume += sets.reduce(
          (sum, s) => sum + s.weight_kg * s.reps_completed,
          0
        );
        sessionCount++;
      }
    }
    weeks.push({ week: weekLabel, volume, sessions: sessionCount });
  }

  return weeks;
}
