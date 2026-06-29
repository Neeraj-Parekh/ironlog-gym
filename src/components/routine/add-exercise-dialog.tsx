"use client";
import { useState } from "react";
import type { Exercise, ExerciseType } from "@/lib/types";
import { VisualTagBadge } from "./visual-tag-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddExerciseDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
}

export function AddExerciseDialog({
  open,
  onOpenChange,
  exercises,
  onSelect,
}: AddExerciseDialogProps) {
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");

  // New exercise form
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("");
  const [newType, setNewType] = useState<ExerciseType>("non-machine");

  const muscles = Array.from(
    new Set(exercises.map((e) => e.target_muscle))
  ).sort();

  const filtered = exercises.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = muscleFilter === "all" || e.target_muscle === muscleFilter;
    return matchSearch && matchMuscle;
  });

  const handleCreateNew = () => {
    if (!newName.trim()) return;
    const newExercise: Exercise = {
      id: `ex_custom_${Date.now().toString(36)}`,
      name: newName.trim(),
      target_muscle: newMuscle.trim() || "general",
      exercise_type: newType,
      equipment_id: newType === "machine" ? "none_bodyweight" : "none_bodyweight",
      fallback_ids: [],
      visual_tag: {
        label: "",
        border_color: "#10B981",
        bg_color: "#ECFDF5",
        icon_identifier: "dumbbell",
      },
    };
    onSelect(newExercise);
    setNewName("");
    setNewMuscle("");
    setNewType("non-machine");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogDescription>
            Pick from catalog or create a custom exercise node.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="catalog" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog">From Catalog</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          {/* Catalog tab */}
          <TabsContent
            value="catalog"
            className="flex-1 overflow-hidden flex flex-col gap-2 mt-2"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exercises..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={muscleFilter} onValueChange={setMuscleFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All muscles</SelectItem>
                  {muscles.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="w-full flex items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Dumbbell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ex.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {ex.target_muscle}
                    </p>
                  </div>
                  <VisualTagBadge type={ex.exercise_type} />
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No exercises found. Try creating a custom one.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Custom tab */}
          <TabsContent value="custom" className="space-y-3 mt-2">
            <div>
              <Label htmlFor="ex-name">Exercise Name</Label>
              <Input
                id="ex-name"
                placeholder="e.g. Cable Lateral Raise"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ex-muscle">Target Muscle</Label>
              <Input
                id="ex-muscle"
                placeholder="e.g. shoulders"
                value={newMuscle}
                onChange={(e) => setNewMuscle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Exercise Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(
                  [
                    "machine",
                    "non-machine",
                    "cardio",
                    "stretching",
                  ] as ExerciseType[]
                ).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={cn(
                      "rounded-lg border p-2 text-left transition-colors",
                      newType === t
                        ? "border-foreground bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <VisualTagBadge type={t} />
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCreateNew}
              disabled={!newName.trim()}
              className="w-full gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Custom Exercise
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
