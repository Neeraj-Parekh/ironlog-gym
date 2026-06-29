"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

export interface SetInputsRef {
  weight: number;
  reps: number;
}

interface SetInputsProps {
  nodeId: string;
  initialWeight: number;
  initialReps: number;
  isBarbell: boolean;
  inputsRef: React.MutableRefObject<SetInputsRef>;
  onWeightChange?: (w: number) => void;
  onRepsChange?: (r: number) => void;
}

/**
 * Weight + Reps input block for the active session HUD.
 * Keyed by nodeId in the parent so it remounts (and resets) per exercise.
 * Writes current values to a ref via effect (allowed — refs not state).
 */
export function SetInputs({
  nodeId,
  initialWeight,
  initialReps,
  inputsRef,
  onWeightChange,
  onRepsChange,
}: SetInputsProps) {
  const [weight, setWeight] = useState(String(initialWeight));
  const [reps, setReps] = useState(String(initialReps));

  // Sync ref whenever local state changes (refs in effects are allowed)
  useEffect(() => {
    inputsRef.current.weight = Number(weight) || 0;
  }, [weight, inputsRef]);
  useEffect(() => {
    inputsRef.current.reps = Number(reps) || 0;
  }, [reps, inputsRef]);

  // Push initial values up to parent on mount / when initial values change
  // (so plate-calc display + logSet handler have correct values without user typing)
  useEffect(() => {
    onWeightChange?.(initialWeight);
  }, [initialWeight, onWeightChange]);
  useEffect(() => {
    onRepsChange?.(initialReps);
  }, [initialReps, onRepsChange]);

  const handleWeightChange = (v: string) => {
    setWeight(v);
    onWeightChange?.(Number(v) || 0);
  };
  const handleRepsChange = (v: string) => {
    setReps(v);
    onRepsChange?.(Number(v) || 0);
  };

  return (
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="rounded-xl border-2 border-border bg-card p-3">
        <label className="text-[10px] uppercase text-muted-foreground font-medium">
          Weight
        </label>
        <div className="flex items-baseline gap-1 mt-1">
          <Input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="border-0 p-0 h-12 text-3xl font-bold tabular-nums focus-visible:ring-0 bg-transparent"
          />
          <span className="text-sm text-muted-foreground">kg</span>
        </div>
        <div className="flex gap-1 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() =>
              handleWeightChange(String(Math.max(0, Number(weight) - 2.5)))
            }
          >
            <Minus className="h-3 w-3" />2.5
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => handleWeightChange(String(Number(weight) + 2.5))}
          >
            <Plus className="h-3 w-3" />2.5
          </Button>
        </div>
      </div>

      <div className="rounded-xl border-2 border-border bg-card p-3">
        <label className="text-[10px] uppercase text-muted-foreground font-medium">
          Reps
        </label>
        <div className="flex items-baseline gap-1 mt-1">
          <Input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => handleRepsChange(e.target.value)}
            className="border-0 p-0 h-12 text-3xl font-bold tabular-nums focus-visible:ring-0 bg-transparent"
          />
          <span className="text-sm text-muted-foreground">reps</span>
        </div>
        <div className="flex gap-1 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() =>
              handleRepsChange(String(Math.max(0, Number(reps) - 1)))
            }
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => handleRepsChange(String(Number(reps) + 1))}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
