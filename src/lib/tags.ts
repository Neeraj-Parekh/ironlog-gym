// ============================================================
// Visual Tag System — color-coded exercise classification
// Per architect spec: machine=red, free=green, cardio=blue, stretch=amber
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
    border_color: "#EF4444", // red-500
    bg_color: "#FEF2F2", // red-50
    icon_identifier: "cpu",
    icon: Cpu,
  },
  "non-machine": {
    label: "FREE WEIGHT",
    border_color: "#10B981", // emerald-500
    bg_color: "#ECFDF5", // emerald-50
    icon_identifier: "dumbbell",
    icon: Dumbbell,
  },
  cardio: {
    label: "CARDIO",
    border_color: "#3B82F6", // blue-500
    bg_color: "#EFF6FF", // blue-50
    icon_identifier: "activity",
    icon: Activity,
  },
  stretching: {
    label: "STRETCH",
    border_color: "#F59E0B", // amber-500
    bg_color: "#FEF3C7", // amber-50
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
