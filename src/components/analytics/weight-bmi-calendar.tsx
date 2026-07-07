"use client";
import { useState } from "react";
import { useWeightHistory, useMonthlyCalendar, getBMIColor } from "@/hooks/use-weight-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

// ============================================================
// Weight Trend Graph
// ============================================================
export function WeightTrendGraph() {
  const { weights, latestWeight, latestHeight, loading } = useWeightHistory();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (weights.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-sm text-muted-foreground">
            Log your weight in Body &amp; Hydration to see trends
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = weights.map((w) => ({
    date: w.date.slice(5),
    weight: w.value,
  }));

  const currentWeight = latestWeight?.value ?? 0;
  const heaviest = Math.max(...weights.map((w) => w.value));
  const lightest = Math.min(...weights.map((w) => w.value));
  const heightCm = latestHeight?.value ?? null;
  const heightM = heightCm ? heightCm / 100 : null;
  const bmi = heightM && currentWeight ? currentWeight / (heightM * heightM) : null;

  return (
    <div className="space-y-3">
      {/* Weight graph */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Weight Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {currentWeight}
                <span className="text-sm text-muted-foreground ml-1">kg</span>
              </p>
              <p className="text-xs text-muted-foreground">Current</p>
            </div>
            <div className="text-right">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <div>
                  <p className="font-bold text-foreground">{lightest}kg</p>
                  <p>Lightest</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">{heaviest}kg</p>
                  <p>Heaviest</p>
                </div>
              </div>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 8 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fontSize: 8 }}
                  className="text-muted-foreground"
                  width={30}
                />
                <Tooltip
                  contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                  formatter={(value: number) => [`${value} kg`, "Weight"]}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#weightGrad)"
                />
                {chartData.length > 0 && (
                  <ReferenceDot
                    x={chartData[chartData.length - 1].date}
                    y={currentWeight}
                    r={4}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* BMI bar */}
      {bmi !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              BMI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <p className="text-3xl font-bold tabular-nums">{bmi.toFixed(1)}</p>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: `${getBMIColor(bmi).color}20`, color: getBMIColor(bmi).color }}
              >
                {getBMIColor(bmi).label}
              </span>
            </div>
            {/* Color bar */}
            <div className="relative h-3 rounded-full overflow-hidden flex">
              <div className="flex-1" style={{ backgroundColor: "#3b82f6" }} />
              <div className="flex-1" style={{ backgroundColor: "#10b981" }} />
              <div className="flex-1" style={{ backgroundColor: "#f59e0b" }} />
              <div className="flex-1" style={{ backgroundColor: "#f97316" }} />
              <div className="flex-1" style={{ backgroundColor: "#ef4444" }} />
            </div>
            {/* Indicator */}
            <div className="relative h-1 mt-0.5">
              <div
                className="absolute -top-2 w-1 h-5 rounded-full bg-foreground border-2 border-background shadow-md transition-all"
                style={{ left: `${getBMIColor(bmi).position}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[8px] text-muted-foreground">
              <span>15</span>
              <span>18.5</span>
              <span>25</span>
              <span>30</span>
              <span>35</span>
              <span>40</span>
            </div>
            {heightCm && (
              <p className="text-xs text-muted-foreground mt-2">
                Height: {heightCm}cm · Weight: {currentWeight}kg
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Monthly Calendar
// ============================================================
export function MonthlyCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const { days, loading } = useMonthlyCalendar(year, month);

  const dayMap = new Map(days.map((d) => [d.date, d]));
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const maxVolume = Math.max(...days.map((d) => d.volume), 1);

  const getColor = (volume: number) => {
    if (volume === 0) return "transparent";
    const ratio = volume / maxVolume;
    if (ratio > 0.75) return "#f97316";
    if (ratio > 0.5) return "#fb923c";
    if (ratio > 0.25) return "#fdba74";
    return "#fed7aa";
  };

  const goPrev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {MONTH_NAMES[month]} {year}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d, i) => (
            <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const dayData = dayMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const vol = dayData?.volume ?? 0;

            return (
              <div
                key={dayNum}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] cursor-pointer transition-all active:scale-90",
                  isToday && "ring-1 ring-foreground"
                )}
                style={{
                  backgroundColor: getColor(vol),
                  color: vol > 0 ? "#fff" : undefined,
                }}
                title={dayData ? `${dateStr}: ${vol.toLocaleString()}kg, ${dayData.sessionCount} session(s)` : dateStr}
              >
                <span className={cn("font-medium", vol === 0 && "text-muted-foreground")}>
                  {dayNum}
                </span>
                {vol > 0 && (
                  <span className="text-[7px] opacity-80">{(vol / 1000).toFixed(1)}k</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-[9px] text-muted-foreground">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[3px] bg-[#fed7aa]" />
          <div className="w-3 h-3 rounded-[3px] bg-[#fdba74]" />
          <div className="w-3 h-3 rounded-[3px] bg-[#fb923c]" />
          <div className="w-3 h-3 rounded-[3px] bg-[#f97316]" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
