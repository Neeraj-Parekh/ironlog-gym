"use client";
import { useVitalityLog, useVitalityInsights } from "@/hooks/use-vitality";
import {
  computeMovingAverage,
  getVitalityLabel,
} from "@/lib/vitality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export function VitalityAnalytics() {
  const { logs } = useVitalityLog();
  const { insights, loading } = useVitalityInsights(logs.length);

  if (logs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-sm text-muted-foreground">
            Log vitality for 7+ days to see trends and correlations
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data with 7-day moving average
  const chartData = computeMovingAverage(
    logs.map((l) => ({ date: l.date, score: l.computed_score }))
  ).map((p) => ({
    date: p.date.slice(5), // MM-DD
    score: p.score,
    avg: p.avg,
  }));

  // Latest score
  const latest = logs[0];
  const latestInfo = getVitalityLabel(latest.computed_score);

  return (
    <div className="space-y-3">
      {/* Latest score banner */}
      <Card
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${latestInfo.color}15, transparent)`,
        }}
      >
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Latest · {new Date(latest.date).toLocaleDateString([], { month: "short", day: "numeric" })}
              </p>
              <p
                className="text-4xl font-bold mt-1"
                style={{ color: latestInfo.color }}
              >
                {latest.computed_score}
                <span className="text-lg text-muted-foreground">/100</span>
              </p>
              <p className="font-medium text-sm mt-1">{latestInfo.label}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total logs</p>
              <p className="text-2xl font-bold">{logs.length}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{latestInfo.description}</p>
        </CardContent>
      </Card>

      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Vitality Trend (7-day moving avg)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="vitalityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9 }}
                  className="text-muted-foreground"
                  width={30}
                />
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                  formatter={(value: number, name: string) => [
                    `${value}`,
                    name === "score" ? "Daily" : "7-day avg",
                  ]}
                />
                <ReferenceLine y={65} stroke="#84cc16" strokeDasharray="3 3" label={{ value: "High", fontSize: 9, fill: "#84cc16" }} />
                <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Mod", fontSize: 9, fill: "#f59e0b" }} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  fill="url(#vitalityGrad)"
                  opacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {!loading && insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Pattern Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {insights.map((insight, i) => {
                const Icon =
                  insight.type === "positive"
                    ? TrendingUp
                    : insight.type === "negative"
                    ? TrendingDown
                    : Minus;
                const color =
                  insight.type === "positive"
                    ? "text-emerald-500"
                    : insight.type === "negative"
                    ? "text-rose-500"
                    : "text-muted-foreground";
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-muted/30 p-2.5"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", color)} />
                    <p className="text-xs">{insight.text}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Insights generated from your logged data. More patterns appear as you log more days.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
