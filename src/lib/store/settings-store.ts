// ============================================================
// Settings store — user preferences (persisted to localStorage)
// Haptics, notification style, rest timer defaults
// ============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type RestNotificationStyle = "haptics" | "color_wave" | "both" | "silent";

interface SettingsState {
  // Haptics / vibration
  hapticsEnabled: boolean;
  // Rest timer completion notification style
  restNotificationStyle: RestNotificationStyle;
  // Default rest seconds
  defaultRestSeconds: number;
  // Rest timer auto-start after logging a set
  autoStartRest: boolean;

  // Setters
  setHapticsEnabled: (v: boolean) => void;
  setRestNotificationStyle: (v: RestNotificationStyle) => void;
  setDefaultRestSeconds: (v: number) => void;
  setAutoStartRest: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      restNotificationStyle: "color_wave",
      defaultRestSeconds: 120,
      autoStartRest: true,

      setHapticsEnabled: (v) => set({ hapticsEnabled: v }),
      setRestNotificationStyle: (v) => set({ restNotificationStyle: v }),
      setDefaultRestSeconds: (v) => set({ defaultRestSeconds: v }),
      setAutoStartRest: (v) => set({ autoStartRest: v }),
    }),
    {
      name: "ironlog-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
