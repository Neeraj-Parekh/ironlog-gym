// ============================================================
// Zustand app store — view routing, versioning mode, day selection
// (active-session state lives in a separate store, Phase 2)
// ============================================================
import { create } from "zustand";
import type { DayOfWeek, VersioningMode } from "@/lib/types";

export type AppView =
  | "week" // 7-day routine grid
  | "day_batch_edit" // full-day batch editor
  | "ai_gateway" // import/export portal
  | "analytics" // charts & records (Phase 4)
  | "biometrics" // water + body metrics (Phase 3)
  | "active_workout"; // live session HUD (Phase 2)

interface AppState {
  view: AppView;
  selectedDay: DayOfWeek;
  versioningMode: VersioningMode;
  // Navigation
  setView: (v: AppView) => void;
  setSelectedDay: (d: DayOfWeek) => void;
  setVersioningMode: (m: VersioningMode) => void;
  // Convenience: open a day's batch editor
  openDayEditor: (d: DayOfWeek) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "week",
  selectedDay: 1, // Monday
  versioningMode: "this_week_only",
  setView: (v) => set({ view: v }),
  setSelectedDay: (d) => set({ selectedDay: d }),
  setVersioningMode: (m) => set({ versioningMode: m }),
  openDayEditor: (d) => set({ selectedDay: d, view: "day_batch_edit" }),
}));
