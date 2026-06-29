"use client";
import { WaterTracker } from "./water-tracker";
import { BiometricPrompts } from "./biometric-prompts";
import { RecoveryTracker } from "./recovery-tracker";

export function BiometricsView() {
  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <RecoveryTracker />
      <WaterTracker />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Body Metrics
        </h3>
        <BiometricPrompts />
      </div>
    </div>
  );
}
