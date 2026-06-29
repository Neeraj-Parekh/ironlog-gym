"use client";
import { getTag } from "@/lib/tags";
import type { ExerciseType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VisualTagBadgeProps {
  type: ExerciseType;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Color-coded exercise classification badge.
 * machine=red, non-machine=green, cardio=blue, stretching=amber
 */
export function VisualTagBadge({ type, size = "sm", className }: VisualTagBadgeProps) {
  const tag = getTag(type);
  const Icon = tag.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className
      )}
      style={{
        borderColor: tag.border_color,
        backgroundColor: tag.bg_color,
        color: tag.border_color,
      }}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {tag.label}
    </span>
  );
}
