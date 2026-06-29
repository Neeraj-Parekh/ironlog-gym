"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  colorSchema: string; // iron | ember | rose | ocean | violet
  setMode: (m: ThemeMode) => void;
  setColorSchema: (s: string) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",
      colorSchema: "iron",
      setMode: (m) => set({ mode: m }),
      setColorSchema: (s) => set({ colorSchema: s }),
      toggleMode: () => {
        const current = get().mode;
        const next = current === "dark" ? "light" : "dark";
        set({ mode: next });
      },
    }),
    {
      name: "ironlog-theme",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
