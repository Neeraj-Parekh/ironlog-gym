// ============================================================
// Haptics utility — vibration patterns for button feedback
// Respects the global hapticsEnabled setting
// ============================================================
import { useSettingsStore } from "@/lib/store/settings-store";

export type HapticPattern = "light" | "medium" | "heavy" | "success" | "error" | "select";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: [30, 20, 30],
  success: [20, 40, 20],
  error: [50, 30, 50, 30, 50],
  select: 15,
};

export function haptic(pattern: HapticPattern = "light"): void {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  const { hapticsEnabled } = useSettingsStore.getState();
  if (!hapticsEnabled) return;

  navigator.vibrate(PATTERNS[pattern]);
}
