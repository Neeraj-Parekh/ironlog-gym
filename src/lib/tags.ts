// ============================================================
// Visual Tag System — color-coded exercise classification
// Uses CSS custom properties so colors adapt to the active theme
// ============================================================
import {
  Cpu,
  Dumbbell,
  Activity,
  Accessibility,
  type LucideIcon,
} from "lucide-react";
import type { ExerciseType, VisualTag } from "./types";

export const TAG_CONFIG: Record<
  ExerciseType,
  VisualTag & { icon: LucideIcon }
> = {
  machine: {
    label: "MACHINE",
    border_color: "hsl(0, 84%, 60%)",
    bg_color: "hsl(0, 84%, 97%)",
    icon_identifier: "cpu",
    icon: Cpu,
  },
  "non-machine": {
    label: "FREE WEIGHT",
    border_color: "hsl(160, 84%, 39%)",
    bg_color: "hsl(160, 84%, 96%)",
    icon_identifier: "dumbbell",
    icon: Dumbbell,
  },
  cardio: {
    label: "CARDIO",
    border_color: "hsl(217, 91%, 60%)",
    bg_color: "hsl(214, 95%, 96%)",
    icon_identifier: "activity",
    icon: Activity,
  },
  stretching: {
    label: "STRETCH",
    border_color: "hsl(38, 92%, 50%)",
    bg_color: "hsl(48, 96%, 89%)",
    icon_identifier: "accessibility",
    icon: Accessibility,
  },
};

export function getTag(type: ExerciseType): VisualTag & { icon: LucideIcon } {
  return TAG_CONFIG[type];
}

export function getTagStyle(type: ExerciseType): React.CSSProperties {
  const tag = TAG_CONFIG[type];
  return {
    borderColor: tag.border_color,
    backgroundColor: tag.bg_color,
    color: tag.border_color,
  };
}
