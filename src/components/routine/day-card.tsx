"use client";
import { VisualTagBadge } from "./visual-tag-badge";
import type { DayOfWeek, RoutineNode } from "@/lib/types";
import { ChevronRight, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayCardProps {
  day: DayOfWeek;
  label: string;
  nodes: RoutineNode[];
  onClick: () => void;
}

export function DayCard({ day, label, nodes, onClick }: DayCardProps) {
  const exercises = nodes.filter((n) => n.block_type === "exercise");
  const preBlock = nodes.find((n) => n.block_type === "pre");
  const postBlock = nodes.find((n) => n.block_type === "post");
  const today = new Date().getDay();
  const isToday = day === today;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border bg-card p-4 text-left transition-all",
        "hover:border-foreground/20 hover:shadow-md active:scale-[0.98]",
        isToday && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 flex-col items-center justify-center rounded-xl",
              isToday ? "bg-foreground text-background" : "bg-muted"
            )}
          >
            <span className="text-[10px] font-medium uppercase leading-none">
              {DAY_SHORT[day]}
            </span>
            <span className="text-lg font-bold leading-none mt-0.5">
              {new Date(
                new Date().setDate(
                  new Date().getDate() - new Date().getDay() + day
                )
              ).getDate()}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight">{label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exercises.length === 0
                ? "No exercises — tap to add"
                : `${exercises.length} exercise${exercises.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
      </div>

      {/* Fixed blocks summary */}
      {(preBlock || postBlock) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {preBlock && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>{preBlock.duration_minutes}m stretch</span>
            </div>
          )}
          {postBlock && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>{postBlock.duration_minutes}m cardio</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Exercise tags preview */}
      {exercises.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {exercises.slice(0, 4).map((ex) => (
            <VisualTagBadge key={ex.id} type={ex.exercise_type} />
          ))}
          {exercises.length > 4 && (
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">
              +{exercises.length - 4} more
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <Plus className="h-3.5 w-3.5" />
          <span>Add exercises via AI Import or editor</span>
        </div>
      )}
    </button>
  );
}
