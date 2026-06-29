"use client";
import { useEffect } from "react";
import { useThemeStore } from "@/lib/store/theme-store";
import { getSchema } from "@/lib/theme-schemas";

/**
 * Applies the selected color schema + dark/light mode by setting
 * CSS variables on :root.
 */
export function ThemeApplier() {
  const mode = useThemeStore((s) => s.mode);
  const colorSchema = useThemeStore((s) => s.colorSchema);

  useEffect(() => {
    const root = document.documentElement;

    // Determine effective mode (system → resolve via matchMedia)
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effectiveDark = mode === "dark" || (mode === "system" && systemDark);

    // Toggle dark class
    root.classList.toggle("dark", effectiveDark);

    // Apply color schema CSS variables
    const schema = getSchema(colorSchema);
    const vars = effectiveDark ? schema.dark : schema.light;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(`--${key}`, value);
    }

    // Set color-scheme for native form controls
    root.style.colorScheme = effectiveDark ? "dark" : "light";
  }, [mode, colorSchema]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = document.documentElement;
      root.classList.toggle("dark", mq.matches);
      root.style.colorScheme = mq.matches ? "dark" : "light";
      // Re-apply schema vars
      const schema = getSchema(useThemeStore.getState().colorSchema);
      const vars = mq.matches ? schema.dark : schema.light;
      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(`--${key}`, value);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return null;
}
