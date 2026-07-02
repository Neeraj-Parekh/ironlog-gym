"use client";
import { VitalityTracker } from "./vitality-tracker";
import { VitalityAnalytics } from "./vitality-analytics";
import { SorenessPrompt } from "./soreness-prompt";
import { WaterTracker } from "./water-tracker";
import { BiometricPrompts } from "./biometric-prompts";
import { RecoveryTracker } from "./recovery-tracker";

export function BiometricsView() {
  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* Soreness prompt (only shows if sessions need check) */}
      <SorenessPrompt />

      {/* Vitality tracker (daily check-in) */}
      <VitalityTracker />

      {/* Recovery today */}
      <RecoveryTracker />

      {/* Hydration */}
      <WaterTracker />

      {/* Body metrics */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Body Metrics
        </h3>
        <BiometricPrompts />
      </div>

      {/* Vitality analytics (trends + insights) */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Vitality Trends
        </h3>
        <VitalityAnalytics />
      </div>
    </div>
  );
}
