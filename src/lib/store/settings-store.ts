// ============================================================
// Settings store — user preferences (persisted to localStorage)
// Haptics, notification style, rest timer defaults
// ============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type RestNotificationStyle = "haptics" | "color_wave" | "both" | "silent";
export type SoundEffect = "none" | "chime" | "beep" | "click";

interface SettingsState {
  // Haptics / vibration
  hapticsEnabled: boolean;
  // Rest timer completion notification style
  restNotificationStyle: RestNotificationStyle;
  // Default rest seconds
  defaultRestSeconds: number;
  // Rest timer auto-start after logging a set
  autoStartRest: boolean;
  // Sound effects
  soundEnabled: boolean;
  soundEffect: SoundEffect;
  // Water goal (0 = auto-calculate from bodyweight)
  waterGoalMl: number;
  // Show progression suggestions in HUD
  showProgressionSuggestions: boolean;
  // Show warm-up calculator
  showWarmupCalc: boolean;

  // Setters
  setHapticsEnabled: (v: boolean) => void;
  setRestNotificationStyle: (v: RestNotificationStyle) => void;
  setDefaultRestSeconds: (v: number) => void;
  setAutoStartRest: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setSoundEffect: (v: SoundEffect) => void;
  setWaterGoalMl: (v: number) => void;
  setShowProgressionSuggestions: (v: boolean) => void;
  setShowWarmupCalc: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      restNotificationStyle: "color_wave",
      defaultRestSeconds: 120,
      autoStartRest: true,
      soundEnabled: false,
      soundEffect: "chime",
      waterGoalMl: 0, // 0 = auto from bodyweight
      showProgressionSuggestions: true,
      showWarmupCalc: true,

      setHapticsEnabled: (v) => set({ hapticsEnabled: v }),
      setRestNotificationStyle: (v) => set({ restNotificationStyle: v }),
      setDefaultRestSeconds: (v) => set({ defaultRestSeconds: v }),
      setAutoStartRest: (v) => set({ autoStartRest: v }),
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setSoundEffect: (v) => set({ soundEffect: v }),
      setWaterGoalMl: (v) => set({ waterGoalMl: v }),
      setShowProgressionSuggestions: (v) => set({ showProgressionSuggestions: v }),
      setShowWarmupCalc: (v) => set({ showWarmupCalc: v }),
    }),
    {
      name: "ironlog-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
