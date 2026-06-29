// ============================================================
// Color schema presets — 5 themes, each with light + dark variants
// Applied dynamically via CSS variables on :root
// ============================================================

export interface ColorSchema {
  id: string;
  name: string;
  description: string;
  // CSS variable values for light mode
  light: {
    primary: string;
    "primary-foreground": string;
    ring: string;
    accent: string;
    "accent-foreground": string;
    "chart-1": string;
    "chart-2": string;
    "chart-3": string;
    "chart-4": string;
    "chart-5": string;
  };
  dark: {
    primary: string;
    "primary-foreground": string;
    ring: string;
    accent: string;
    "accent-foreground": string;
    "chart-1": string;
    "chart-2": string;
    "chart-3": string;
    "chart-4": string;
    "chart-5": string;
  };
}

export const COLOR_SCHEMAS: ColorSchema[] = [
  {
    id: "iron",
    name: "Iron",
    description: "Emerald on zinc — the default",
    light: {
      primary: "oklch(0.55 0.15 160)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.55 0.15 160)",
      accent: "oklch(0.95 0.03 160)",
      "accent-foreground": "oklch(0.3 0.1 160)",
      "chart-1": "oklch(0.55 0.2 160)",
      "chart-2": "oklch(0.6 0.15 180)",
      "chart-3": "oklch(0.65 0.18 140)",
      "chart-4": "oklch(0.7 0.15 200)",
      "chart-5": "oklch(0.6 0.2 120)",
    },
    dark: {
      primary: "oklch(0.7 0.15 160)",
      "primary-foreground": "oklch(0.15 0.02 160)",
      ring: "oklch(0.6 0.15 160)",
      accent: "oklch(0.25 0.04 160)",
      "accent-foreground": "oklch(0.9 0.05 160)",
      "chart-1": "oklch(0.65 0.2 160)",
      "chart-2": "oklch(0.7 0.15 180)",
      "chart-3": "oklch(0.6 0.18 140)",
      "chart-4": "oklch(0.55 0.15 200)",
      "chart-5": "oklch(0.65 0.2 120)",
    },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Amber-orange flame",
    light: {
      primary: "oklch(0.6 0.2 45)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.6 0.2 45)",
      accent: "oklch(0.95 0.04 45)",
      "accent-foreground": "oklch(0.35 0.15 45)",
      "chart-1": "oklch(0.6 0.22 45)",
      "chart-2": "oklch(0.65 0.18 25)",
      "chart-3": "oklch(0.7 0.15 60)",
      "chart-4": "oklch(0.55 0.2 15)",
      "chart-5": "oklch(0.65 0.2 350)",
    },
    dark: {
      primary: "oklch(0.72 0.18 45)",
      "primary-foreground": "oklch(0.15 0.02 45)",
      ring: "oklch(0.65 0.18 45)",
      accent: "oklch(0.25 0.05 45)",
      "accent-foreground": "oklch(0.9 0.06 45)",
      "chart-1": "oklch(0.7 0.22 45)",
      "chart-2": "oklch(0.65 0.18 25)",
      "chart-3": "oklch(0.6 0.15 60)",
      "chart-4": "oklch(0.6 0.2 15)",
      "chart-5": "oklch(0.65 0.2 350)",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Pink-rose intensity",
    light: {
      primary: "oklch(0.6 0.22 15)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.6 0.22 15)",
      accent: "oklch(0.95 0.04 15)",
      "accent-foreground": "oklch(0.35 0.15 15)",
      "chart-1": "oklch(0.6 0.24 15)",
      "chart-2": "oklch(0.65 0.2 350)",
      "chart-3": "oklch(0.7 0.18 30)",
      "chart-4": "oklch(0.55 0.22 0)",
      "chart-5": "oklch(0.65 0.2 340)",
    },
    dark: {
      primary: "oklch(0.72 0.2 15)",
      "primary-foreground": "oklch(0.15 0.02 15)",
      ring: "oklch(0.65 0.2 15)",
      accent: "oklch(0.25 0.05 15)",
      "accent-foreground": "oklch(0.9 0.06 15)",
      "chart-1": "oklch(0.7 0.24 15)",
      "chart-2": "oklch(0.65 0.2 350)",
      "chart-3": "oklch(0.6 0.18 30)",
      "chart-4": "oklch(0.6 0.22 0)",
      "chart-5": "oklch(0.65 0.2 340)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Teal-cyan depths",
    light: {
      primary: "oklch(0.55 0.14 200)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.55 0.14 200)",
      accent: "oklch(0.95 0.03 200)",
      "accent-foreground": "oklch(0.3 0.1 200)",
      "chart-1": "oklch(0.55 0.18 200)",
      "chart-2": "oklch(0.6 0.15 220)",
      "chart-3": "oklch(0.65 0.16 180)",
      "chart-4": "oklch(0.6 0.18 240)",
      "chart-5": "oklch(0.55 0.15 190)",
    },
    dark: {
      primary: "oklch(0.7 0.14 200)",
      "primary-foreground": "oklch(0.15 0.02 200)",
      ring: "oklch(0.6 0.14 200)",
      accent: "oklch(0.25 0.04 200)",
      "accent-foreground": "oklch(0.9 0.05 200)",
      "chart-1": "oklch(0.65 0.18 200)",
      "chart-2": "oklch(0.7 0.15 220)",
      "chart-3": "oklch(0.6 0.16 180)",
      "chart-4": "oklch(0.55 0.18 240)",
      "chart-5": "oklch(0.65 0.15 190)",
    },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Purple-magenta energy",
    light: {
      primary: "oklch(0.55 0.2 300)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.55 0.2 300)",
      accent: "oklch(0.95 0.04 300)",
      "accent-foreground": "oklch(0.35 0.15 300)",
      "chart-1": "oklch(0.55 0.22 300)",
      "chart-2": "oklch(0.6 0.18 280)",
      "chart-3": "oklch(0.65 0.2 320)",
      "chart-4": "oklch(0.6 0.18 340)",
      "chart-5": "oklch(0.55 0.2 260)",
    },
    dark: {
      primary: "oklch(0.7 0.2 300)",
      "primary-foreground": "oklch(0.15 0.02 300)",
      ring: "oklch(0.6 0.2 300)",
      accent: "oklch(0.25 0.05 300)",
      "accent-foreground": "oklch(0.9 0.06 300)",
      "chart-1": "oklch(0.65 0.22 300)",
      "chart-2": "oklch(0.7 0.18 280)",
      "chart-3": "oklch(0.6 0.2 320)",
      "chart-4": "oklch(0.55 0.18 340)",
      "chart-5": "oklch(0.65 0.2 260)",
    },
  },
];

export function getSchema(id: string): ColorSchema {
  return COLOR_SCHEMAS.find((s) => s.id === id) ?? COLOR_SCHEMAS[0];
}
