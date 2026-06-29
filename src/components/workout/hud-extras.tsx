"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Flame, History, FileText, Calculator, Zap } from "lucide-react";
import type { WarmupSet } from "@/lib/warmup-calc";
import type { PreviousSessionData } from "@/hooks/use-previous-session";
import { cn } from "@/lib/utils";

interface RpeNotesSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rpe: number | null;
  onRpeChange: (rpe: number | null) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

/** RPE picker + notes sheet — accessible from the LOG SET area */
export function RpeNotesSheet({
  open,
  onOpenChange,
  rpe,
  onRpeChange,
  notes,
  onNotesChange,
}: RpeNotesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Set Details
          </SheetTitle>
          <SheetDescription>
            RPE (Rate of Perceived Exertion) and notes for this set.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* RPE picker */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              RPE (1-10)
            </Label>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <button
                  key={value}
                  onClick={() =>
                    onRpeChange(rpe === value ? null : value)
                  }
                  className={cn(
                    "h-10 rounded-lg border-2 font-bold text-sm transition-all",
                    rpe === value
                      ? value <= 4
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : value <= 7
                        ? "border-amber-500 bg-amber-500/10 text-amber-600"
                        : "border-rose-500 bg-rose-500/10 text-rose-600"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              1-4: Easy · 5-7: Moderate · 8-9: Hard · 10: Max effort
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium mb-1.5 block">
              <FileText className="h-3.5 w-3.5 inline mr-1" />
              Set Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="How did this set feel? Form cues, bar speed, etc."
              className="min-h-[80px] text-sm"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Previous session reference card */
export function PreviousSessionCard({ data }: { data: PreviousSessionData | null }) {
  if (!data) return null;

  return (
    <div className="mb-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <History className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-[10px] font-semibold uppercase text-sky-600 dark:text-sky-400">
          Last time · {new Date(data.date).toLocaleDateString([], { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] uppercase text-muted-foreground">Best</p>
          <p className="text-sm font-bold">
            {data.bestWeight}kg × {data.bestReps}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-muted-foreground">Est 1RM</p>
          <p className="text-sm font-bold">{data.best1RM.toFixed(1)}kg</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-muted-foreground">Volume</p>
          <p className="text-sm font-bold">{data.totalVolume}kg</p>
        </div>
      </div>
    </div>
  );
}

/** Warm-up calculator display */
export function WarmupCalcCard({
  sets,
  workingWeight,
}: {
  sets: WarmupSet[];
  workingWeight: number;
}) {
  if (sets.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Calculator className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-400">
          Warm-up Ramp · {workingWeight}kg working
        </span>
      </div>
      <div className="space-y-1">
        {sets.map((s) => (
          <div
            key={s.set_number}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">
              {s.label} ({s.percentage}%)
            </span>
            <span className="font-mono font-bold">
              {s.weight_kg}kg × {s.reps}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Progression suggestion card */
export function ProgressionCard({
  suggestion,
}: {
  suggestion: {
    suggestedWeight: number;
    suggestedReps: number;
    reason: string;
    trend: "increase" | "maintain" | "deload";
  } | null;
}) {
  if (!suggestion) return null;

  const colors = {
    increase: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    maintain: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    deload: "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400",
  };

  const icons = {
    increase: "↑",
    maintain: "→",
    deload: "↓",
  };

  return (
    <div className={cn("mb-3 rounded-lg border p-2.5", colors[suggestion.trend])}>
      <div className="flex items-center gap-1.5 mb-1">
        <Zap className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase">
          Progression {icons[suggestion.trend]} {suggestion.suggestedWeight}kg × {suggestion.suggestedReps}
        </span>
      </div>
      <p className="text-[10px] opacity-80">{suggestion.reason}</p>
    </div>
  );
}
