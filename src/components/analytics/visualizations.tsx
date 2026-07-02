"use client";
import { useState } from "react";
import { useAnnualHeatmap, useMuscleDayHeatmap, useWeeklyStackedVolume, useRingStats, useWeeklyCompletion } from "@/hooks/use-heatmap-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Dumbbell,
  Flame,
  Trophy,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MUSCLE_COLORS: Record<string, string> = {
  legs: "#ef4444",
  back: "#3b82f6",
  chest: "#f97316",
  shoulders: "#14b8a6",
  biceps: "#a855f7",
  triceps: "#8b5cf6",
  abs: "#f59e0b",
  core: "#f59e0b",
  cardio: "#06b6d4",
};

// ============================================================
// 1. ANNUAL TRAINING HEATMAP (GitHub-style year grid)
// ============================================================
export function AnnualHeatmap({ year }: { year: number }) {
  const { data, loading } = useAnnualHeatmap(year);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  // Build the year grid: 53 weeks × 7 days
  const yearStart = new Date(year, 0, 1);
  const startDay = yearStart.getDay(); // 0=Sunday
  const grid: (DayVolume | null)[][] = [];
  const volMap = new Map(data.map((d) => [d.date, d]));

  let currentDate = new Date(yearStart);
  // Adjust to start on Sunday of the first week
  currentDate.setDate(currentDate.getDate() - startDay);

  for (let week = 0; week < 53; week++) {
    const weekCol: (DayVolume | null)[] = [];
    for (let day = 0; day < 7; day++) {
      if (currentDate.getFullYear() === year) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        weekCol.push(volMap.get(dateStr) ?? null);
      } else {
        weekCol.push(null);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    grid.push(weekCol);
  }

  const maxVolume = Math.max(...data.map((d) => d.volume), 1);

  const getColor = (vol: number | undefined, hasPR: boolean) => {
    if (hasPR) return "#ef4444"; // bright red for PR days
    if (!vol || vol === 0) return "#27272a"; // dark gray
    const ratio = vol / maxVolume;
    if (ratio > 0.75) return "#f97316"; // bright orange
    if (ratio > 0.5) return "#fb923c"; // orange
    if (ratio > 0.25) return "#fdba74"; // light orange
    if (ratio > 0) return "#fed7aa"; // peach
    return "#27272a";
  };

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {year} Training Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Month labels */}
        <div className="flex gap-[3px] ml-6 mb-1 text-[9px] text-muted-foreground">
          {monthLabels.map((m, i) => (
            <span key={m} className="w-[26px]">
              {m}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px] overflow-x-auto pb-2">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1 text-[9px] text-muted-foreground justify-around">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          {/* Week columns */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                const dateStr = day?.date;
                const isToday =
                  dateStr === new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={di}
                    className={cn(
                      "w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-all hover:ring-1 hover:ring-foreground",
                      isToday && "ring-1 ring-foreground"
                    )}
                    style={{
                      backgroundColor: getColor(day?.volume, day?.hasPR ?? false),
                    }}
                    onClick={() => setSelectedDay(day?.date ?? null)}
                    title={
                      day
                        ? `${day.date}: ${day.volume.toLocaleString()}kg, ${day.sessionCount} session${day.hasPR ? " 🏆 PR" : ""}`
                        : ""
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#27272a]" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#fed7aa]" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#fdba74]" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#fb923c]" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#f97316]" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-[#ef4444]" />
          <span>More</span>
          <span className="ml-2 text-red-500">■ PR Day</span>
        </div>

        {/* Selected day info */}
        {selectedDay && (
          <div className="mt-3 rounded-lg bg-muted/50 p-2 text-xs">
            {(() => {
              const day = volMap.get(selectedDay);
              if (!day) return <span className="text-muted-foreground">{selectedDay}: No training</span>;
              return (
                <span>
                  <strong>{selectedDay}</strong>: {day.volume.toLocaleString()}kg ·{" "}
                  {day.sessionCount} session{day.hasPR && " · 🏆 PR"}
                </span>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 2. BOLD HERO STATS — massive numbers
// ============================================================
export function HeroStats({
  sessions,
  totalVolume,
  streak,
  best1RM,
}: {
  sessions: number;
  totalVolume: number;
  streak: number;
  best1RM: number;
}) {
  const stats = [
    {
      icon: Dumbbell,
      value: String(sessions),
      label: "Sessions",
      color: "text-emerald-500",
    },
    {
      icon: TrendingUp,
      value: `${(totalVolume / 1000).toFixed(1)}k`,
      label: "kg Volume",
      color: "text-amber-500",
    },
    {
      icon: Flame,
      value: String(streak),
      label: "Day Streak",
      color: "text-orange-500",
    },
    {
      icon: Trophy,
      value: `${best1RM.toFixed(0)}`,
      label: "kg Best 1RM",
      color: "text-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <Card key={i} className="relative overflow-hidden">
            <CardContent className="pt-4 pb-4">
              <Icon className={cn("h-5 w-5 mb-2", stat.color)} />
              <p className={cn("text-4xl font-black tabular-nums leading-none", stat.color)}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// 3. STACKED WEEKLY VOLUME BARS (by muscle group)
// ============================================================
export function StackedWeeklyVolume() {
  const { data, loading } = useWeeklyStackedVolume();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="h-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  // Get all unique muscle groups
  const muscleGroups = new Set<string>();
  data.forEach((d) => {
    Object.keys(d).forEach((k) => {
      if (k !== "day") muscleGroups.add(k);
    });
  });
  const muscles = Array.from(muscleGroups);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Weekly Volume by Muscle Group
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 9 }}
                className="text-muted-foreground"
                width={40}
              />
              <Tooltip
                contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString()} kg`,
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "9px", paddingTop: "8px" }}
                iconType="circle"
              />
              {muscles.map((muscle) => (
                <Bar
                  key={muscle}
                  dataKey={muscle}
                  stackId="a"
                  fill={MUSCLE_COLORS[muscle] ?? "#64748b"}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 4. TRIPLE PROGRESS RINGS
// ============================================================
export function TripleProgressRings() {
  const { stats, loading } = useRingStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const rings = [
    {
      label: "Weekly Volume",
      value: stats.weeklyVolume,
      goal: stats.weeklyVolumeGoal,
      unit: "kg",
      color: "#f97316",
      icon: TrendingUp,
    },
    {
      label: "Monthly Sessions",
      value: stats.monthlySessions,
      goal: stats.monthlySessionGoal,
      unit: "",
      color: "#3b82f6",
      icon: Dumbbell,
    },
    {
      label: "Streak",
      value: stats.currentStreak,
      goal: stats.streakGoal,
      unit: "d",
      color: "#10b981",
      icon: Flame,
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="flex items-center justify-around">
          {rings.map((ring, i) => {
            const Icon = ring.icon;
            const progress = Math.min(1, ring.value / ring.goal);
            const size = 96;
            const stroke = 8;
            const radius = (size - stroke) / 2;
            const circumference = 2 * Math.PI * radius;
            const dashOffset = circumference * (1 - progress);

            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="relative" style={{ width: size, height: size }}>
                  <svg width={size} height={size} className="-rotate-90">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={stroke}
                      className="text-muted opacity-20"
                    />
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={ring.color}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Icon className="h-4 w-4 mb-0.5" style={{ color: ring.color }} />
                    <span
                      className="text-sm font-bold"
                      style={{ color: ring.color }}
                    >
                      {ring.value.toLocaleString()}
                      {ring.unit && (
                        <span className="text-[9px] text-muted-foreground">
                          {ring.unit}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground text-center max-w-[80px]">
                  {ring.label}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  / {ring.goal.toLocaleString()}
                  {ring.unit}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 5. WEEK-VIEW COMPLETION GRID (M-S checkmarks)
// ============================================================
export function WeekCompletionGrid() {
  const { data, loading } = useWeeklyCompletion(0);

  if (loading) return null;

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const orderedData = [...data].sort((a, b) => {
    const aOrder = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const bOrder = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return aOrder - bOrder;
  });

  const statusConfig = {
    completed: { icon: "✓", color: "bg-emerald-500 text-white" },
    missed: { icon: "✗", color: "bg-rose-500 text-white" },
    partial: { icon: "◐", color: "bg-amber-500 text-white" },
    upcoming: { icon: "○", color: "bg-muted text-muted-foreground" },
    rest: { icon: "—", color: "bg-muted/50 text-muted-foreground" },
  };

  return (
    <div className="flex items-center justify-between gap-1">
      {orderedData.map((day, i) => {
        const config = statusConfig[day.status];
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span className="text-[9px] text-muted-foreground font-medium">
              {dayNames[i]}
            </span>
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                config.color
              )}
            >
              {config.icon}
            </div>
            {day.volume > 0 && (
              <span className="text-[8px] text-muted-foreground">
                {(day.volume / 1000).toFixed(1)}k
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 6. MUSCLE × DAY-OF-WEEK HEATMAP
// ============================================================
export function MuscleDayHeatmap() {
  const { data, loading } = useMuscleDayHeatmap();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun

  // Get all unique muscles
  const muscleSet = new Set(data.map((d) => d.muscle));
  const muscles = Array.from(muscleSet).sort();

  // Build lookup
  const volMap = new Map<string, number>();
  data.forEach((d) => {
    volMap.set(`${d.muscle}|${d.dayOfWeek}`, d.volume);
  });

  const maxVol = Math.max(...data.map((d) => d.volume), 1);

  const getColor = (vol: number | undefined) => {
    if (!vol || vol === 0) return "#27272a";
    const ratio = vol / maxVol;
    if (ratio > 0.75) return "#f97316";
    if (ratio > 0.5) return "#fb923c";
    if (ratio > 0.25) return "#fdba74";
    return "#fed7aa";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Dumbbell className="h-4 w-4" />
          Muscle × Day Pattern
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[9px] text-muted-foreground pb-1 pr-2">
                  Muscle
                </th>
                {dayOrder.map((d) => (
                  <th
                    key={d}
                    className="text-center text-[9px] text-muted-foreground pb-1 px-1"
                  >
                    {dayNames[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {muscles.map((muscle) => (
                <tr key={muscle}>
                  <td className="text-[10px] capitalize py-0.5 pr-2 text-muted-foreground">
                    {muscle}
                  </td>
                  {dayOrder.map((d) => {
                    const vol = volMap.get(`${muscle}|${d}`);
                    return (
                      <td key={d} className="text-center py-0.5 px-0.5">
                        <div
                          className="w-full h-6 rounded-[3px] mx-auto transition-all hover:scale-110"
                          style={{ backgroundColor: getColor(vol) }}
                          title={
                            vol
                              ? `${muscle} ${dayNames[d]}: ${vol.toLocaleString()}kg`
                              : `${muscle} ${dayNames[d]}: —`
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 text-[9px] text-muted-foreground">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[2px] bg-[#27272a]" />
          <div className="w-3 h-3 rounded-[2px] bg-[#fed7aa]" />
          <div className="w-3 h-3 rounded-[2px] bg-[#fdba74]" />
          <div className="w-3 h-3 rounded-[2px] bg-[#fb923c]" />
          <div className="w-3 h-3 rounded-[2px] bg-[#f97316]" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Import for the day volume type
interface DayVolume {
  date: string;
  volume: number;
  sessionCount: number;
  hasPR: boolean;
}
