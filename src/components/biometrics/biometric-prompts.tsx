"use client";
import { useState } from "react";
import { useBiometrics } from "@/hooks/use-biometrics";
import type { BiometricMetric } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Scale, Lock, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Tier-1: bodyweight, prompted 2-4x/month (every ~10 days)
const TIER1_INTERVAL_DAYS = 10;
// Tier-2: height, muscle mass, body fat % — every 3 months
const TIER2_INTERVAL_DAYS = 90;

const TIER2_METRICS: Array<{
  metric: BiometricMetric;
  label: string;
  unit: string;
  placeholder: string;
}> = [
  { metric: "height", label: "Height", unit: "cm", placeholder: "175" },
  { metric: "muscle_mass", label: "Muscle Mass", unit: "kg", placeholder: "65" },
  { metric: "body_fat_pct", label: "Body Fat %", unit: "%", placeholder: "15" },
];

export function BiometricPrompts() {
  const { getLatest, daysSince, addBiometric } = useBiometrics();
  const [showTier1, setShowTier1] = useState(false);
  const [showTier2, setShowTier2] = useState(false);
  const [tier1Value, setTier1Value] = useState("");
  const [tier2Values, setTier2Values] = useState<Record<string, string>>({});

  // Determine which prompts to show
  const bodyweightDays = daysSince("body_weight");
  const tier2Days = daysSince("muscle_mass"); // use muscle_mass as proxy for tier-2

  const showTier1Prompt =
    bodyweightDays === null || bodyweightDays >= TIER1_INTERVAL_DAYS;
  const showTier2Prompt =
    tier2Days === null || tier2Days >= TIER2_INTERVAL_DAYS;

  const latestWeight = getLatest("body_weight");

  const handleSaveTier1 = async () => {
    const val = Number(tier1Value);
    if (!val || val <= 0) return;
    await addBiometric(1, "body_weight", val, "kg");
    setTier1Value("");
    setShowTier1(false);
  };

  const handleSaveTier2 = async () => {
    for (const { metric, unit } of TIER2_METRICS) {
      const val = Number(tier2Values[metric]);
      if (val && val > 0) {
        await addBiometric(2, metric, val, unit);
      }
    }
    setTier2Values({});
    setShowTier2(false);
  };

  return (
    <div className="space-y-3">
      {/* Tier-1: Bodyweight prompt */}
      <Card
        className={cn(
          "cursor-pointer transition-all",
          showTier1Prompt && "ring-2 ring-amber-500/30"
        )}
        onClick={() => showTier1Prompt && setShowTier1(true)}
      >
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Scale className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">Body Weight</h3>
              <span className="text-[9px] font-bold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                Tier 1
              </span>
            </div>
            {latestWeight ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last: {latestWeight.value} {latestWeight.unit}
                {bodyweightDays !== null && (
                  <span className="ml-1">
                    · {bodyweightDays} day{bodyweightDays !== 1 ? "s" : ""} ago
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Not logged yet — tap to set
              </p>
            )}
          </div>
          {showTier1Prompt ? (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowTier1(true);
              }}
            >
              Log
            </Button>
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CardContent>
      </Card>

      {/* Tier-2: Locked biometrics */}
      <Card
        className={cn(
          "cursor-pointer transition-all",
          showTier2Prompt && "ring-2 ring-violet-500/30"
        )}
        onClick={() => showTier2Prompt && setShowTier2(true)}
      >
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">Body Composition</h3>
              <span className="text-[9px] font-bold uppercase bg-violet-500/20 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded">
                Tier 2
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Height, muscle mass, body fat %
              {tier2Days !== null ? (
                <span className="ml-1">
                  · {tier2Days} day{tier2Days !== 1 ? "s" : ""} ago
                </span>
              ) : (
                <span className="ml-1">· not set</span>
              )}
            </p>
          </div>
          {showTier2Prompt ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setShowTier2(true);
              }}
            >
              Update
            </Button>
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Tier-1 prompts every ~10 days. Tier-2 unlocks every 3 months and
          locks after confirmation to prevent accidental edits.
        </p>
      </div>

      {/* Tier-1 dialog */}
      <Dialog open={showTier1} onOpenChange={setShowTier1}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Body Weight</DialogTitle>
            <DialogDescription>
              {latestWeight
                ? `Last logged: ${latestWeight.value} ${latestWeight.unit}`
                : "Enter your current body weight."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="weight-input">Weight (kg)</Label>
            <Input
              id="weight-input"
              type="number"
              inputMode="decimal"
              step={0.1}
              value={tier1Value}
              onChange={(e) => setTier1Value(e.target.value)}
              placeholder={latestWeight?.value.toString() ?? "75"}
              className="mt-1 text-lg font-bold h-12 text-center"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTier1(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTier1} disabled={!tier1Value}>
              Save Weight
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier-2 dialog (locks after save) */}
      <Dialog open={showTier2} onOpenChange={setShowTier2}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Body Composition Update
            </DialogTitle>
            <DialogDescription>
              This window unlocks every 3 months. After saving, it locks to
              prevent accidental edits. Fill in what you know.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {TIER2_METRICS.map(({ metric, label, unit, placeholder }) => {
              const latest = getLatest(metric);
              return (
                <div key={metric}>
                  <Label className="text-xs">
                    {label} ({unit})
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step={metric === "body_fat_pct" ? 0.1 : 1}
                      value={tier2Values[metric] ?? ""}
                      onChange={(e) =>
                        setTier2Values((prev) => ({
                          ...prev,
                          [metric]: e.target.value,
                        }))
                      }
                      placeholder={placeholder}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-8">
                      {unit}
                    </span>
                  </div>
                  {latest && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Last: {latest.value} {latest.unit}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTier2(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTier2}
              disabled={Object.values(tier2Values).every((v) => !v)}
            >
              Save &amp; Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
