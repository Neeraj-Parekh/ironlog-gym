"use client";
import { useState, useEffect } from "react";
import { getDB } from "@/lib/dexie";
import { getWeekStartNWeeksAgo, getWeekEndNWeeksAgo } from "@/lib/calendar-weeks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  computeACWR,
  computeMonotony,
  computeWeeklySetsPerMuscle,
  rpeToRir,
  computeSessionDensity,
  type ACWRResult,
  type MonotonyResult,
  type MuscleVolumeResult,
} from "@/lib/training-metrics";
import type { Session, SessionSet, Exercise } from "@/lib/types";
import {
  Shield,
  Activity,
  Dumbbell,
  Gauge,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// 1. ACWR Gauge — injury risk indicator
// ============================================================
export function ACWRGauge({
  sessions,
}: {
  sessions: Array<{ session: Session; sets: SessionSet[] }>;
}) {
  const [result, setResult] = useState<ACWRResult | null>(null);

  useEffect(() => {
    const r = computeACWR(sessions);
    setResult(r);
  }, [sessions]);

  if (!result) return null;

  const zoneColors = {
    safe: "#10b981",
    caution: "#f59e0b",
    high_risk: "#ef4444",
    undertrained: "#64748b",
  };

  const color = zoneColors[result.zone];
  // Position on a 0-2 scale (0 = nothing, 2 = way too much)
  const position = Math.min(100, (result.ratio / 2) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color }} />
          Injury Risk (ACWR)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Gauge */}
          <div className="relative w-24 h-24 shrink-0">
            <svg width="96" height="96" className="-rotate-90">
              {/* Background arc */}
              <circle
                cx="48" cy="48" r="40"
                fill="none" stroke="#27272a" strokeWidth="10"
                strokeDasharray="188 251"
                strokeLinecap="round"
              />
              {/* Undertrained zone */}
              <circle
                cx="48" cy="48" r="40"
                fill="none" stroke="#64748b" strokeWidth="10"
                strokeDasharray="37 251"
                strokeDashoffset="-188"
                opacity="0.3"
              />
              {/* Safe zone */}
              <circle
                cx="48" cy="48" r="40"
                fill="none" stroke="#10b981" strokeWidth="10"
                strokeDasharray="50 251"
                strokeDashoffset="-225"
                opacity="0.3"
              />
              {/* Caution zone */}
              <circle
                cx="48" cy="48" r="40"
                fill="none" stroke="#f59e0b" strokeWidth="10"
                strokeDasharray="19 251"
                strokeDashoffset="-275"
                opacity="0.3"
              />
              {/* High risk zone */}
              <circle
                cx="48" cy="48" r="40"
                fill="none" stroke="#ef4444" strokeWidth="10"
                strokeDasharray="25 251"
                strokeDashoffset="-294"
                opacity="0.3"
              />
              {/* Needle indicator */}
              <circle
                cx="48" cy="48" r="4"
                fill={color}
                style={{
                  transform: `rotate(${(result.ratio / 2) * 270 - 135}deg)`,
                  transformOrigin: "48px 48px",
                  transition: "transform 0.7s ease-out",
                }}
              />
              <line
                x1="48" y1="48" x2="48" y2="14"
                stroke={color} strokeWidth="2" strokeLinecap="round"
                style={{
                  transform: `rotate(${(result.ratio / 2) * 270 - 135}deg)`,
                  transformOrigin: "48px 48px",
                  transition: "transform 0.7s ease-out",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
              <span className="text-lg font-bold tabular-nums" style={{ color }}>
                {result.ratio.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm capitalize" style={{ color }}>
              {result.zone.replace("_", " ")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{result.message}</p>
            <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
              <span>Acute: <strong className="text-foreground">{Math.round(result.acuteLoad).toLocaleString()}kg</strong></span>
              <span>Chronic: <strong className="text-foreground">{Math.round(result.chronicLoad).toLocaleString()}kg</strong></span>
            </div>
          </div>
        </div>

        {/* Scale */}
        <div className="flex items-center gap-px mt-3 h-2 rounded-full overflow-hidden">
          <div className="w-[40%] bg-slate-500/30" />
          <div className="w-[25%] bg-emerald-500/30" />
          <div className="w-[10%] bg-amber-500/30" />
          <div className="w-[25%] bg-rose-500/30" />
        </div>
        <div className="flex justify-between mt-1 text-[8px] text-muted-foreground">
          <span>0</span>
          <span>0.8</span>
          <span>1.3</span>
          <span>1.5</span>
          <span>2.0+</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 2. Training Monotony Trend
// ============================================================
export function MonotonyTrend({
  sessions,
}: {
  sessions: Array<{ session: Session; sets: SessionSet[] }>;
}) {
  const [monotonyHistory, setMonotonyHistory] = useState<
    Array<{ week: string; monotony: number }>
  >([]);

  useEffect(() => {
    // Compute monotony for each of the last 8 weeks
    const history: Array<{ week: string; monotony: number }> = [];
    for (let i = 7; i >= 0; i--) {
      // Use calendar weeks (Mon-Sun) instead of rolling 7-day windows
      const weekStart = getWeekStartNWeeksAgo(i);
      const weekEnd = getWeekEndNWeeksAgo(i);

      const weekSessions = sessions.filter((s) => {
        const d = new Date(s.session.started_at);
        return d >= weekStart && d <= weekEnd;
      });

      const dailyLoads = [0, 0, 0, 0, 0, 0, 0];
      for (const s of weekSessions) {
        const dayIdx = new Date(s.session.started_at).getDay();
        const vol = s.sets.reduce((v, set) => v + set.weight_kg * set.reps_completed, 0);
        dailyLoads[dayIdx] += vol;
      }
      const total = dailyLoads.reduce((a, b) => a + b, 0);
      const avg = total / 7;
      if (avg === 0) continue;
      const variance = dailyLoads.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / 7;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;

      history.push({
        week: weekEnd.toLocaleDateString([], { month: "short", day: "numeric" }),
        monotony: avg / stdDev,
      });
    }
    setMonotonyHistory(history);
  }, [sessions]);

  if (monotonyHistory.length < 2) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-xs text-muted-foreground">
            Need 2+ weeks of data for monotony trend
          </p>
        </CardContent>
      </Card>
    );
  }

  const current = monotonyHistory[monotonyHistory.length - 1]?.monotony ?? 0;
  const riskColor = current < 1.0 ? "#10b981" : current < 2.0 ? "#f59e0b" : "#ef4444";
  const riskLabel = current < 1.0 ? "Low risk" : current < 2.0 ? "Moderate" : "High risk";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: riskColor }} />
          Training Monotony
          <span className="ml-auto text-xs font-bold" style={{ color: riskColor }}>
            {current.toFixed(2)} · {riskLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monotonyHistory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 8 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 8 }} className="text-muted-foreground" width={30} />
              <Tooltip
                contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                formatter={(value: number) => [value.toFixed(2), "Monotony"]}
              />
              <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "High risk", fontSize: 8, fill: "#ef4444" }} />
              <ReferenceLine y={1.0} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Safe", fontSize: 8, fill: "#10b981" }} />
              <Line
                type="monotone"
                dataKey="monotony"
                stroke={riskColor}
                strokeWidth={2.5}
                dot={{ r: 3, fill: riskColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          High monotony (&gt;2.0) = overtraining risk. Vary your training load.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 3. Weekly Sets per Muscle — Volume Landmine
// ============================================================
export function VolumeLandmine({
  sessions,
  exercises,
}: {
  sessions: Array<{ session: Session; sets: SessionSet[] }>;
  exercises: Exercise[];
}) {
  const [data, setData] = useState<MuscleVolumeResult[]>([]);

  useEffect(() => {
    const result = computeWeeklySetsPerMuscle(sessions, exercises);
    setData(result);
  }, [sessions, exercises]);

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-xs text-muted-foreground">
            No training data this week
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Dumbbell className="h-4 w-4" />
          Weekly Volume Landmine
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 8 }} className="text-muted-foreground" />
              <YAxis
                type="category"
                dataKey="muscle"
                tick={{ fontSize: 9 }}
                className="text-muted-foreground"
                width={60}
              />
              <Tooltip
                contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                formatter={(value: number, _name: string, props: { payload: MuscleVolumeResult }) => [
                  `${value} sets (${(props.payload.weeklyVolume / 1000).toFixed(1)}k kg)`,
                  props.payload.zone,
                ]}
              />
              <ReferenceLine x={10} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine x={20} stroke="#f59e0b" strokeDasharray="3 3" />
              <Bar dataKey="weeklySets" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span>Under (&lt;10)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>Optimal (10-20)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>Junk (&gt;20)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 4. RIR Display (used inline on set chips)
// ============================================================
export function RIRBadge({ rpe }: { rpe: number | undefined }) {
  if (!rpe) return null;
  const rir = rpeToRir(rpe);
  const color = rir === 0 ? "#ef4444" : rir <= 2 ? "#f59e0b" : "#10b981";
  return (
    <span
      className="text-[9px] font-bold ml-0.5"
      style={{ color }}
      title={`${rpe} RPE = ${rir} reps in reserve`}
    >
      ({rir} RIR)
    </span>
  );
}

// ============================================================
// 5. Session Density (shown on each session in history)
// ============================================================
export function DensityBadge({
  session,
  sets,
}: {
  session: Session;
  sets: SessionSet[];
}) {
  const [density, setDensity] = useState<{ density: number; durationMin: number } | null>(null);

  useEffect(() => {
    const result = computeSessionDensity(session, sets);
    setDensity(result);
  }, [session, sets]);

  if (!density) return null;

  const efficiency = density.density;
  const color = efficiency > 200 ? "#10b981" : efficiency > 100 ? "#f59e0b" : "#64748b";

  return (
    <div className="flex items-center gap-1 text-[10px]" style={{ color }}>
      <Gauge className="h-3 w-3" />
      <span className="font-bold">{density.density} kg/min</span>
      <span className="text-muted-foreground">· {density.durationMin}min</span>
    </div>
  );
}
