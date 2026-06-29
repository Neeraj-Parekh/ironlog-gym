"use client";
import { useState } from "react";
import type { RoutineNode, Exercise, SetOverride } from "@/lib/types";
import { VisualTagBadge } from "./visual-tag-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Settings2, Trash2, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseEditorRowProps {
  node: RoutineNode;
  index: number;
  exercises: Exercise[];
  onUpdate: (patch: Partial<RoutineNode>) => void;
  onDelete: () => void;
}

export function ExerciseEditorRow({
  node,
  index,
  exercises,
  onUpdate,
  onDelete,
}: ExerciseEditorRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverrides =
    node.sets_override && node.sets_override.length > 0;

  const toggleOverrides = (checked: boolean) => {
    if (checked) {
      // Initialize sets_override based on sets_count
      const count = node.sets_count ?? 3;
      const overrides: SetOverride[] = Array.from({ length: count }, (_, i) => ({
        set_number: i + 1,
        target_reps: node.target_reps_default ?? 10,
        target_weight_kg: 0,
      }));
      onUpdate({ sets_override: overrides });
    } else {
      onUpdate({ sets_override: [] });
    }
  };

  const updateSetOverride = (setNum: number, patch: Partial<SetOverride>) => {
    const current = node.sets_override ?? [];
    const updated = current.map((s) =>
      s.set_number === setNum ? { ...s, ...patch } : s
    );
    onUpdate({ sets_override: updated });
  };

  const updateSetsCount = (count: number) => {
    const clamped = Math.max(1, Math.min(10, count));
    onUpdate({ sets_count: clamped });
    // If overrides exist, resize the array
    if (node.sets_override && node.sets_override.length > 0) {
      const current = node.sets_override;
      const newOverrides: SetOverride[] = Array.from(
        { length: clamped },
        (_, i) =>
          current[i] ?? {
            set_number: i + 1,
            target_reps: node.target_reps_default ?? 10,
            target_weight_kg: 0,
          }
      );
      onUpdate({ sets_override: newOverrides });
    }
  };

  const toggleFallback = (exId: string) => {
    const current = node.fallback_ids ?? [];
    if (current.includes(exId)) {
      onUpdate({
        fallback_ids: current.filter((id) => id !== exId),
      });
    } else {
      onUpdate({ fallback_ids: [...current, exId] });
    }
  };

  // Available fallbacks (same muscle group or all)
  const fallbackOptions = exercises.filter(
    (e) => e.id !== node.exercise_id
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-2 p-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {node.name}
            </h3>
            <VisualTagBadge type={node.exercise_type} />
          </div>
          {node.fallback_ids && node.fallback_ids.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {node.fallback_ids.length} fallback
              {node.fallback_ids.length > 1 ? "s" : ""} linked
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">
            Sets
          </Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={node.sets_count ?? 3}
            onChange={(e) => updateSetsCount(Number(e.target.value))}
            className="h-9 mt-0.5 text-center font-semibold"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">
            Reps
          </Label>
          <Input
            type="number"
            min={1}
            value={node.target_reps_default ?? 10}
            onChange={(e) =>
              onUpdate({ target_reps_default: Number(e.target.value) })
            }
            className="h-9 mt-0.5 text-center font-semibold"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">
            Rest (s)
          </Label>
          <Input
            type="number"
            min={0}
            step={15}
            value={node.prescribed_rest_seconds ?? 120}
            onChange={(e) =>
              onUpdate({
                prescribed_rest_seconds: Number(e.target.value),
              })
            }
            className="h-9 mt-0.5 text-center font-semibold"
          />
        </div>
      </div>

      {/* Collapsible advanced editor */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleContent className="border-t bg-muted/20">
          <div className="p-3 space-y-4">
            {/* Per-set targets */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`overrides-${node.id}`}
                  checked={!!hasOverrides}
                  onCheckedChange={(v) => toggleOverrides(v === true)}
                />
                <Label
                  htmlFor={`overrides-${node.id}`}
                  className="text-xs font-medium cursor-pointer"
                >
                  Set individual set targets (weight × reps)
                </Label>
              </div>

              {hasOverrides && node.sets_override && (
                <div className="space-y-1.5 mt-2">
                  {node.sets_override.map((s) => (
                    <div
                      key={s.set_number}
                      className="flex items-center gap-2 rounded-lg bg-background p-2"
                    >
                      <span className="text-xs font-bold w-6 shrink-0">
                        S{s.set_number}
                      </span>
                      <div className="flex-1 flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          step={2.5}
                          value={s.target_weight_kg}
                          onChange={(e) =>
                            updateSetOverride(s.set_number, {
                              target_weight_kg: Number(e.target.value),
                            })
                          }
                          className="h-8 text-center text-sm"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">
                          kg
                        </span>
                      </div>
                      <span className="text-muted-foreground">×</span>
                      <div className="flex-1 flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={s.target_reps}
                          onChange={(e) =>
                            updateSetOverride(s.set_number, {
                              target_reps: Number(e.target.value),
                            })
                          }
                          className="h-8 text-center text-sm"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">
                          reps
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fallback exercises */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Fallback Exercises (ordered alternatives)
              </Label>
              {node.fallback_ids && node.fallback_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {node.fallback_ids.map((fid, idx) => {
                    const ex = exercises.find((e) => e.id === fid);
                    return (
                      <span
                        key={fid}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {idx + 1}.
                        </span>
                        {ex?.name ?? fid}
                        <button
                          onClick={() => toggleFallback(fid)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <Select onValueChange={(v) => toggleFallback(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Add fallback exercise" />
                </SelectTrigger>
                <SelectContent>
                  {fallbackOptions.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name} ({ex.target_muscle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="w-full gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Exercise
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground border-t"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
        {expanded ? "Collapse" : "Advanced"}
      </button>
    </div>
  );
}
