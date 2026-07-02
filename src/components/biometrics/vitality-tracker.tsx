"use client";
import { useState } from "react";
import { useVitalityLog } from "@/hooks/use-vitality";
import { getVitalityLabel } from "@/lib/vitality";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Flame, Battery, Heart, Zap, Sparkles, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

// Marker configurations
const ERECTION_LABELS = ["None", "Weak", "Moderate", "Strong"];
const FIVE_LABELS = ["Very Low", "Low", "OK", "Good", "Excellent"];

interface MarkerConfig {
  key: string;
  label: string;
  icon: typeof Flame;
  values: number[];
  labels: string[];
  max: number;
  core?: boolean;
}

const MARKERS: MarkerConfig[] = [
  // Core markers (shown by default — strongest T proxies)
  {
    key: "morning_erection",
    label: "Morning Erection",
    icon: Moon,
    values: [0, 1, 2, 3],
    labels: ERECTION_LABELS,
    max: 3,
    core: true,
  },
  { key: "libido", label: "Libido", icon: Heart, values: [1, 2, 3, 4, 5], labels: FIVE_LABELS, max: 5, core: true },
  { key: "drive", label: "Drive", icon: Flame, values: [1, 2, 3, 4, 5], labels: FIVE_LABELS, max: 5, core: true },
  // Optional markers (collapsible)
  { key: "confidence", label: "Confidence", icon: Zap, values: [1, 2, 3, 4, 5], labels: FIVE_LABELS, max: 5, core: false },
  { key: "energy", label: "Energy", icon: Battery, values: [1, 2, 3, 4, 5], labels: FIVE_LABELS, max: 5, core: false },
  { key: "muscle_fullness", label: "Muscle Fullness", icon: Sparkles, values: [1, 2, 3, 4, 5], labels: FIVE_LABELS, max: 5, core: false },
  { key: "sleep_quality", label: "Sleep Quality", icon: Moon, values: [1, 2, 3, 4, 5], labels: FIVE_LABELS, max: 5, core: false },
];

// ---- Single marker input ----
function MarkerInput({
  marker,
  currentValue,
  onSelect,
}: {
  marker: MarkerConfig;
  currentValue: number;
  onSelect: (key: string, value: number) => void;
}) {
  const Icon = marker.icon;
  return (
    <div>
      <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {marker.label}
      </label>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${marker.values.length}, 1fr)` }}
      >
        {marker.values.map((value, idx) => (
          <button
            key={value}
            onClick={() => onSelect(marker.key, value)}
            className={cn(
              "h-12 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5",
              currentValue === value ? "scale-105" : "border-border opacity-50"
            )}
            style={
              currentValue === value
                ? {
                    borderColor: getColorForValue(value, marker.max),
                    backgroundColor: `${getColorForValue(value, marker.max)}15`,
                    color: getColorForValue(value, marker.max),
                  }
                : undefined
            }
          >
            <span className="font-bold text-sm">{value}</span>
            <span className="text-[9px]">{marker.labels[idx]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Optional markers (collapsible) ----
function OptionalMarkers({
  markers,
  values,
  onSelect,
}: {
  markers: MarkerConfig[];
  values: Record<string, number>;
  onSelect: (key: string, value: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className="h-3.5 w-3.5" />
        Show detailed markers (4 more)
      </button>
    );
  }
  return (
    <>
      {markers.map((marker) => (
        <MarkerInput
          key={marker.key}
          marker={marker}
          currentValue={values[marker.key]}
          onSelect={onSelect}
        />
      ))}
      <button
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronUp className="h-3.5 w-3.5" />
        Show less
      </button>
    </>
  );
}

export function VitalityTracker() {
  const { todayLog, logs, saveVitality } = useVitalityLog();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(
    todayLog
      ? {
          morning_erection: todayLog.morning_erection,
          libido: todayLog.libido,
          drive: todayLog.drive,
          confidence: todayLog.confidence,
          energy: todayLog.energy,
          muscle_fullness: todayLog.muscle_fullness,
          sleep_quality: todayLog.sleep_quality,
        }
      : {
          morning_erection: 1,
          libido: 3,
          drive: 3,
          confidence: 3,
          energy: 3,
          muscle_fullness: 3,
          sleep_quality: 3,
        }
  );
  const [notes, setNotes] = useState(todayLog?.notes ?? "");

  const todayScore = todayLog?.computed_score ?? null;
  const scoreInfo = todayScore !== null ? getVitalityLabel(todayScore) : null;

  // 7-day average
  const recentLogs = logs.slice(0, 7);
  const avgScore =
    recentLogs.length > 0
      ? Math.round(
          recentLogs.reduce((s, l) => s + l.computed_score, 0) /
            recentLogs.length
        )
      : null;

  const handleSave = async () => {
    await saveVitality({
      morning_erection: values.morning_erection as 0 | 1 | 2 | 3,
      libido: values.libido as 1 | 2 | 3 | 4 | 5,
      drive: values.drive as 1 | 2 | 3 | 4 | 5,
      confidence: values.confidence as 1 | 2 | 3 | 4 | 5,
      energy: values.energy as 1 | 2 | 3 | 4 | 5,
      muscle_fullness: values.muscle_fullness as 1 | 2 | 3 | 4 | 5,
      sleep_quality: values.sleep_quality as 1 | 2 | 3 | 4 | 5,
      notes: notes || undefined,
    });
    haptic("success");
    toast.success("Vitality check-in saved");
    setOpen(false);
  };

  const setMarker = (key: string, value: number) => {
    haptic("select");
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <Card
        className="relative overflow-hidden cursor-pointer"
        onClick={() => setOpen(true)}
      >
        {/* Gradient background based on score */}
        {scoreInfo && (
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `radial-gradient(circle at top right, ${scoreInfo.color}, transparent 70%)`,
            }}
          />
        )}
        <CardContent className="pt-6 pb-6 relative">
          <div className="flex items-center gap-4">
            {/* Score ring */}
            <div className="relative shrink-0">
              <VitalityRing score={todayScore} color={scoreInfo?.color} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <h3 className="font-bold">Vitality</h3>
              </div>
              {todayScore !== null ? (
                <>
                  <p
                    className="text-2xl font-bold leading-none"
                    style={{ color: scoreInfo?.color }}
                  >
                    {todayScore}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scoreInfo?.label} · 7d avg {avgScore ?? "—"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mt-1">Not logged today</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tap for morning check-in (~30s)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Mini 7-day sparkline */}
          {recentLogs.length > 1 && (
            <div className="mt-4 flex items-end justify-between gap-1 h-12">
              {[...recentLogs].reverse().map((log, i) => {
                const info = getVitalityLabel(log.computed_score);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${log.computed_score}%`,
                      backgroundColor: info.color,
                      opacity: 0.4 + (i / recentLogs.length) * 0.6,
                    }}
                    title={`${log.date}: ${log.computed_score}`}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Morning Vitality Check-in
            </SheetTitle>
            <SheetDescription>
              Rate how you feel right now. Takes 30 seconds.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            {/* Core markers (always shown) */}
            {MARKERS.filter((m) => m.core).map((marker) => (
              <MarkerInput
                key={marker.key}
                marker={marker}
                currentValue={values[marker.key]}
                onSelect={setMarker}
              />
            ))}

            {/* Optional markers (collapsible) */}
            <OptionalMarkers
              markers={MARKERS.filter((m) => !m.core)}
              values={values}
              onSelect={setMarker}
            />

            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations? (mood, body, energy patterns)"
                className="min-h-[60px] text-sm"
              />
            </div>

            <Button
              className="w-full gap-1.5"
              size="lg"
              onClick={handleSave}
            >
              <Flame className="h-4 w-4" />
              Save Check-in
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ---- Score ring component ----
function VitalityRing({
  score,
  color,
}: {
  score: number | null;
  color?: string;
}) {
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? score / 100 : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted opacity-20"
        />
        {/* Progress circle */}
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color ?? "#f59e0b"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {score !== null ? (
          <span className="text-lg font-bold" style={{ color }}>
            {score}
          </span>
        ) : (
          <Flame className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function getColorForValue(value: number, max: number): string {
  const ratio = value / max;
  if (ratio >= 0.8) return "#10b981"; // emerald
  if (ratio >= 0.6) return "#84cc16"; // lime
  if (ratio >= 0.4) return "#f59e0b"; // amber
  if (ratio >= 0.2) return "#f97316"; // orange
  return "#ef4444"; // red
}
