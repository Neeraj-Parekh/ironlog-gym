"use client";
import { useState, useEffect } from "react";
import { getDB } from "@/lib/dexie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computePushPullRatio,
  computeStrengthStandards,
  computeDeloadRecommendation,
  computeTrainingStrain,
  computeRelativeVolume,
  type PushPullResult,
  type StrengthStandard,
  type DeloadRecommendation,
  type ACWRResult,
  type MonotonyResult,
} from "@/lib/training-metrics";
import type { Session, SessionSet, Biometric } from "@/lib/types";
import {
  Scale,
  Trophy,
  AlertTriangle,
  Zap,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Phase 2: Push:Pull Ratio
// ============================================================
export function PushPullRatio({
  sessions,
  exercises,
}: {
  sessions: Array<{ session: Session; sets: SessionSet[] }>;
  exercises: Array<{ id: string; target_muscle: string }>;
}) {
  const [result, setResult] = useState<PushPullResult | null>(null);

  useEffect(() => {
    setResult(computePushPullRatio(sessions, exercises));
  }, [sessions, exercises]);

  if (!result || (result.pushVolume === 0 && result.pullVolume === 0)) return null;

  const total = result.pushVolume + result.pullVolume;
  const pushPct = total > 0 ? (result.pushVolume / total) * 100 : 50;

  const balanceColor =
    result.balance === "balanced" ? "#10b981" :
    result.balance === "push_dominant" ? "#f59e0b" : "#3b82f6";
  const balanceLabel =
    result.balance === "balanced" ? "Balanced" :
    result.balance === "push_dominant" ? "Push-heavy" : "Pull-heavy";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Push:Pull Ratio
          <span className="ml-auto text-xs font-bold" style={{ color: balanceColor }}>
            {result.ratio} · {balanceLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-6 rounded-full overflow-hidden">
          <div
            className="flex items-center justify-center text-[10px] font-bold text-white"
            style={{ width: `${pushPct}%`, backgroundColor: "#f59e0b" }}
          >
            {pushPct > 15 && `Push ${(result.pushVolume / 1000).toFixed(1)}k`}
          </div>
          <div
            className="flex items-center justify-center text-[10px] font-bold text-white"
            style={{ width: `${100 - pushPct}%`, backgroundColor: "#3b82f6" }}
          >
            {(100 - pushPct) > 15 && `Pull ${(result.pullVolume / 1000).toFixed(1)}k`}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Ideal: 1:1 to 2:1 (push:pull). Imbalance → posture/shoulder issues.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Phase 2: Strength Standards
// ============================================================
export function StrengthStandards({
  sessions,
  bodyweight,
}: {
  sessions: Array<{ session: Session; sets: SessionSet[] }>;
  bodyweight: number | null;
}) {
  const [standards, setStandards] = useState<StrengthStandard[]>([]);

  useEffect(() => {
    setStandards(computeStrengthStandards(sessions, bodyweight));
  }, [sessions, bodyweight]);

  if (standards.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Strength Standards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {standards.map((s) => (
            <div key={s.exercise} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{s.exercise}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (s.ratio / 3) * 100)}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold">{s.oneRM.toFixed(0)}kg</p>
                <p className="text-[9px] capitalize" style={{ color: s.color }}>
                  {s.level} ({s.ratio.toFixed(1)}×BW)
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Phase 2: Deload Recommendation
// ============================================================
export function DeloadAlert({
  sessions,
  acwr,
  monotony,
}: {
  sessions: Array<{ session: Session; sets: SessionSet[] }>;
  acwr: ACWRResult | null;
  monotony: MonotonyResult | null;
}) {
  const [rec, setRec] = useState<DeloadRecommendation | null>(null);

  useEffect(() => {
    setRec(computeDeloadRecommendation(sessions, acwr, monotony));
  }, [sessions, acwr, monotony]);

  if (!rec || !rec.shouldDeload) return null;

  const severityColors = {
    suggested: { bg: "bg-amber-500/5", border: "border-amber-500/30", text: "text-amber-600" },
    recommended: { bg: "bg-orange-500/5", border: "border-orange-500/30", text: "text-orange-600" },
    critical: { bg: "bg-rose-500/5", border: "border-rose-500/30", text: "text-rose-600" },
  };
  const c = severityColors[rec.severity as keyof typeof severityColors] ?? severityColors.suggested;

  return (
    <div className={cn("rounded-xl border p-3", c.bg, c.border)}>
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className={cn("h-4 w-4", c.text)} />
        <span className={cn("text-sm font-bold capitalize", c.text)}>
          {rec.severity === "critical" ? "Deload Critical" : rec.severity === "recommended" ? "Deload Recommended" : "Consider Deload"}
        </span>
      </div>
      <ul className="space-y-0.5 ml-6">
        {rec.reasons.map((r, i) => (
          <li key={i} className="text-xs text-muted-foreground">• {r}</li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground mt-2">
        Reduce volume to 60% and weight to 85% for 1 week.
      </p>
    </div>
  );
}

// ============================================================
// Phase 2: Relative Volume (VL/BW)
// ============================================================
export function RelativeVolumeBadge({
  totalVolume,
  bodyweight,
}: {
  totalVolume: number;
  bodyweight: number | null;
}) {
  const [rv, setRv] = useState<number | null>(null);

  useEffect(() => {
    setRv(computeRelativeVolume(totalVolume, bodyweight));
  }, [totalVolume, bodyweight]);

  if (rv === null) return null;

  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <TrendingUp className="h-3 w-3" />
      <span>Relative: <strong className="text-foreground">{rv.toLocaleString()}</strong> VL/BW</span>
    </div>
  );
}

// ============================================================
// Phase 3: Training Strain
// ============================================================
export function TrainingStrainCard({
  monotony,
}: {
  monotony: MonotonyResult | null;
}) {
  const [strain, setStrain] = useState<{ strain: number; level: string; color: string } | null>(null);

  useEffect(() => {
    setStrain(computeTrainingStrain(monotony));
  }, [monotony]);

  if (!strain) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${strain.color}20` }}>
          <Zap className="h-5 w-5" style={{ color: strain.color }} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: strain.color }}>
            {strain.strain.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Training Strain · {strain.level}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
