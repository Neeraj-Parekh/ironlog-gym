"use client";
import { useState, useEffect, useCallback } from "react";
import { getDB } from "@/lib/dexie";
import { useAppStore } from "@/lib/store/app-store";
import {
  useActiveVersion,
  useRoutineNodes,
  useDayLabels,
  useExercises,
} from "@/hooks/use-routine";
import type {
  DayOfWeek,
  RoutineNode,
  Exercise,
  SetOverride,
  ExerciseType,
} from "@/lib/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExerciseEditorRow } from "./exercise-editor-row";
import { AddExerciseDialog } from "./add-exercise-dialog";
import { VisualTagBadge } from "./visual-tag-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  duplicateDay,
  applyDeloadWeek,
} from "@/lib/session-helpers";
import { Lock, Plus, Save, ArrowLeft, Trash2, Copy, TrendingDown, GripVertical, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
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

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---- Sortable wrapper for ExerciseEditorRow ----
interface SortableExerciseRowProps {
  node: RoutineNode;
  index: number;
  exercises: Exercise[];
  onUpdate: (patch: Partial<RoutineNode>) => void;
  onDelete: () => void;
}

function SortableExerciseRow({
  node,
  index,
  exercises,
  onUpdate,
  onDelete,
}: SortableExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="pl-6">
        <ExerciseEditorRow
          node={node}
          index={index}
          exercises={exercises}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

// ---- Expandable fixed block card (shows exercises inside) ----
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Clock } from "lucide-react";

function FixedBlockCard({ block }: { block: RoutineNode }) {
  const [expanded, setExpanded] = useState(false);
  const isStretch = block.exercise_type === "stretching";
  const isCardio = block.exercise_type === "cardio";

  const exercises: string[] = [];
  if (isStretch) {
    exercises.push("Neck mobility (up/down/left/right × 6)");
    exercises.push("Arm circles forward/backward × 10");
    exercises.push("Shoulder rolls forward/backward × 10");
    exercises.push("Chest opener (hold 10-15s × 2)");
    exercises.push("Cross body shoulder stretch (15s each side)");
    exercises.push("Triceps stretch (15s each side)");
    exercises.push("Wrist mobility (10 each direction)");
    exercises.push("Standing side bends (10 each side)");
    exercises.push("Torso rotations (10 each direction)");
    exercises.push("Forward bend (hold 10s × 2)");
    exercises.push("Hip circles (10 clockwise, 10 anticlockwise)");
    exercises.push("Leg swings forward/back (10 each leg)");
    exercises.push("Leg swings side/side (10 each leg)");
    exercises.push("Knee circles (10 each direction)");
    exercises.push("Ankle circles (10 each direction)");
    exercises.push("Bodyweight squats × 15");
    exercises.push("Walking lunges (10 each leg)");
    exercises.push("High knees (20-30 sec)");
    exercises.push("Butt kicks (20-30 sec)");
  }
  if (isCardio) {
    exercises.push("Treadmill — 20-25 min (5-6.5 km/h)");
    exercises.push("Exercise Bike — 20 min");
    exercises.push("Elliptical — 20 min");
    exercises.push("Stairmaster — 15-20 min");
    exercises.push("Chest stretch (wall, 20-30s)");
    exercises.push("Shoulder stretch (cross-body, 20-30s)");
    exercises.push("Triceps stretch (behind head, 20-30s)");
    exercises.push("Lat stretch (overhead lean, 20-30s)");
    exercises.push("Hamstring stretch (toe touch, 20-30s)");
    exercises.push("Quadriceps stretch (hold ankle, 20-30s)");
    exercises.push("Calf stretch (against wall, 20-30s)");
    exercises.push("Hip flexor stretch (lunge position, 20-30s)");
    exercises.push("Glute stretch (figure-4, 20-30s)");
    exercises.push("Butterfly stretch (feet together, 20-30s)");
    exercises.push("Child's pose (30s)");
    exercises.push("Cobra stretch (20s)");
    exercises.push("Cat-cow stretch (8-10 reps)");
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="rounded-xl border border-dashed bg-muted/30 overflow-hidden"
    >
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors active:scale-[0.98]">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <VisualTagBadge type={block.exercise_type} />
          <span className="text-sm font-medium flex-1 truncate">
            {block.name}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {block.duration_minutes} min
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t bg-background/50 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
            {isStretch ? "Warm-up Exercises" : "Cardio + Post-Workout Stretches"}
          </p>
          {exercises.map((ex, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
            >
              <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">
                {i + 1}
              </span>
              <span className="text-xs">{ex}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DayBatchEditor() {
  const { version, loading: vLoading } = useActiveVersion();
  const selectedDay = useAppStore((s) => s.selectedDay);
  const setView = useAppStore((s) => s.setView);
  const versioningMode = useAppStore((s) => s.versioningMode);
  const { labels, reload: reloadLabels } = useDayLabels(version?.id);

  // Local editable state — mirrors DB, only persists on Save
  const [localNodes, setLocalNodes] = useState<RoutineNode[]>([]);
  const [dayLabel, setDayLabel] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<string>("");
  const [editingLabel, setEditingLabel] = useState(false);
  const { exercises } = useExercises();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ---- Drag end handler ----
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalNodes((prev) => {
      const exerciseNodes = prev.filter((n) => n.block_type === "exercise");
      const oldIndex = exerciseNodes.findIndex((n) => n.id === active.id);
      const newIndex = exerciseNodes.findIndex((n) => n.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(exerciseNodes, oldIndex, newIndex);
      // Reassign sequence_order
      const reorderedWithSeq = reordered.map((n, i) => ({
        ...n,
        sequence_order: i + 1,
      }));

      // Rebuild full list with pre/exercise/post order
      const preNodes = prev.filter((n) => n.block_type === "pre");
      const postNodes = prev.filter((n) => n.block_type === "post");
      return [...preNodes, ...reorderedWithSeq, ...postNodes];
    });
    setDirty(true);
  };

  // ---- Duplicate day handler ----
  const handleDuplicate = async () => {
    if (!duplicateTarget) return;
    try {
      await duplicateDay(selectedDay, Number(duplicateTarget) as DayOfWeek);
      toast.success(
        `Copied ${DAY_NAMES[selectedDay]} to ${DAY_NAMES[Number(duplicateTarget)]}`
      );
      setShowDuplicate(false);
      setDuplicateTarget("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate day");
    }
  };

  // ---- Deload week handler ----
  const handleDeload = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await applyDeloadWeek(today);
      toast.success("Deload week created — volume reduced to 60%, weight to 85%");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create deload week");
    }
  };

  // Load nodes for the selected day
  const loadDayNodes = useCallback(async () => {
    if (!version) return;
    const db = getDB();
    const all = await db.routine_nodes
      .where("version_id")
      .equals(version.id)
      .toArray();
    const dayNodes = all
      .filter((n) => n.day_of_week === selectedDay)
      .sort((a, b) => {
        const order = { pre: 0, exercise: 1, post: 2 };
        if (a.block_type !== b.block_type)
          return order[a.block_type] - order[b.block_type];
        return a.sequence_order - b.sequence_order;
      });
    setLocalNodes(dayNodes);
    setDayLabel(labels[selectedDay]);
    setDirty(false);
  }, [version, selectedDay, labels]);

  useEffect(() => {
    loadDayNodes();
  }, [loadDayNodes]);

  // ---- Mutations (local only until Save) ----
  const updateNode = (id: string, patch: Partial<RoutineNode>) => {
    setLocalNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n))
    );
    setDirty(true);
  };

  const deleteNode = (id: string) => {
    setLocalNodes((prev) => prev.filter((n) => n.id !== id));
    setDirty(true);
  };

  const addExercise = (exercise: Exercise) => {
    const maxSeq = Math.max(
      0,
      ...localNodes
        .filter((n) => n.block_type === "exercise")
        .map((n) => n.sequence_order)
    );
    const newNode: RoutineNode = {
      id: uid("node"),
      version_id: version?.id ?? "",
      day_of_week: selectedDay,
      block_type: "exercise",
      sequence_order: maxSeq + 1,
      exercise_id: exercise.id,
      name: exercise.name,
      exercise_type: exercise.exercise_type,
      is_fixed: false,
      sets_count: 3,
      target_reps_default: 10,
      prescribed_rest_seconds: 120,
      sets_override: [],
      fallback_ids: exercise.fallback_ids,
      equipment_source: { type: exercise.equipment_id === "none_bodyweight" ? "bodyweight" : "barbell" },
    } as RoutineNode;
    setLocalNodes((prev) => {
      // Insert before post block
      const postIdx = prev.findIndex((n) => n.block_type === "post");
      if (postIdx === -1) return [...prev, newNode];
      return [...prev.slice(0, postIdx), newNode, ...prev.slice(postIdx)];
    });
    setDirty(true);
    setShowAdd(false);
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!version) return;
    setSaving(true);
    const db = getDB();

    try {
      if (versioningMode === "all_future_weeks") {
        // Create a new immutable version
        const newVersionId = `v_${uid("rev")}`;
        const now = new Date().toISOString();
        const newVersion = {
          ...version,
          id: newVersionId,
          label: `${version.label} (edited)`,
          created_at: now,
          is_active: true,
        };

        // Copy all nodes from old version, but apply local edits for this day
        const allOldNodes = await db.routine_nodes
          .where("version_id")
          .equals(version.id)
          .toArray();

        // Replace this day's nodes with localNodes (remapped to new version_id)
        const otherDayNodes = allOldNodes
          .filter((n) => n.day_of_week !== selectedDay)
          .map((n) => ({ ...n, id: uid("node"), version_id: newVersionId }));

        const thisDayNodes = localNodes.map((n) => ({
          ...n,
          id: uid("node"),
          version_id: newVersionId,
        }));

        // Copy day labels
        const oldLabels = await db.day_labels
          .where("version_id")
          .equals(version.id)
          .toArray();
        const newLabels = oldLabels.map((l) => ({
          ...l,
          id: uid("lbl"),
          version_id: newVersionId,
          label: l.day_of_week === selectedDay ? dayLabel : l.label,
        }));

        await db.transaction(
          "rw",
          [db.routine_versions, db.routine_nodes, db.day_labels],
          async () => {
            // Deactivate old version
            await db.routine_versions.update(version.id, { is_active: false });
            // Insert new version + nodes + labels
            await db.routine_versions.put(newVersion);
            await db.routine_nodes.bulkPut([
              ...otherDayNodes,
              ...thisDayNodes,
            ]);
            await db.day_labels.bulkPut(newLabels);
          }
        );
      } else {
        // this_week_only — edit current version directly
        // (deviation override layer is a Phase 2 refinement)
        const oldDayNodes = await db.routine_nodes
          .where("version_id")
          .equals(version.id)
          .filter((n) => n.day_of_week === selectedDay)
          .toArray();
        const oldIds = oldDayNodes.map((n) => n.id);

        await db.transaction("rw", [db.routine_nodes, db.day_labels], async () => {
          // Delete old day nodes
          await db.routine_nodes.bulkDelete(oldIds);
          // Insert updated nodes
          await db.routine_nodes.bulkPut(localNodes);
          // Update day label
          const existingLabel = await db.day_labels
            .where("version_id")
            .equals(version.id)
            .filter((l) => l.day_of_week === selectedDay && l.is_active)
            .first();
          if (existingLabel) {
            await db.day_labels.update(existingLabel.id, { label: dayLabel });
          }
        });
      }

      setDirty(false);
      toast.success(
        versioningMode === "all_future_weeks"
          ? "New routine version created for all future weeks"
          : "Day updated for this week"
      );
      await reloadLabels();
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (vLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const preBlock = localNodes.find((n) => n.block_type === "pre");
  const postBlock = localNodes.find((n) => n.block_type === "post");
  const exerciseNodes = localNodes.filter((n) => n.block_type === "exercise");

  return (
    <div className="px-4 py-4 pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("week")}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Day header — read-only by default, tap pencil to edit */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {editingLabel ? (
            <>
              <Input
                value={dayLabel}
                onChange={(e) => {
                  setDayLabel(e.target.value);
                  setDirty(true);
                }}
                className="h-12 text-lg font-bold"
                placeholder={`${DAY_NAMES[selectedDay]} routine`}
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => setEditingLabel(false)}
              >
                <Check className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold flex-1">{dayLabel}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => setEditingLabel(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Fixed blocks (locked, expandable) */}
      {(preBlock || postBlock) && (
        <div className="mb-4 space-y-2">
          {preBlock && <FixedBlockCard block={preBlock} />}
          {postBlock && <FixedBlockCard block={postBlock} />}
        </div>
      )}

      {/* Exercise list */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Exercises ({exerciseNodes.length})
        </h2>
        {exerciseNodes.length > 1 && (
          <span className="text-[10px] text-muted-foreground">
            Drag handle to reorder
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={exerciseNodes.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {exerciseNodes.map((node, idx) => (
              <SortableExerciseRow
                key={node.id}
                node={node}
                index={idx + 1}
                exercises={exercises}
                onUpdate={(patch) => updateNode(node.id, patch)}
                onDelete={() => deleteNode(node.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {exerciseNodes.length === 0 && (
        <div className="rounded-xl border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No exercises yet for this day
          </p>
          <Button onClick={() => setShowAdd(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4" />
            Add first exercise
          </Button>
        </div>
      )}

      {/* Day actions */}
      {exerciseNodes.length > 0 && (
        <div className="mt-3 space-y-2">
          <Button
            onClick={() => setShowAdd(true)}
            variant="outline"
            className="w-full gap-1.5 border-dashed"
          >
            <Plus className="h-4 w-4" />
            Add Exercise Node
          </Button>

          {/* Day utilities */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setShowDuplicate(true)}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy to...
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={handleDeload}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Deload week
            </Button>
          </div>
        </div>
      )}

      {/* Add exercise dialog */}
      <AddExerciseDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        exercises={exercises}
        onSelect={addExercise}
      />

      {/* Duplicate day dialog */}
      <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy {DAY_NAMES[selectedDay]} to...</DialogTitle>
            <DialogDescription>
              Copies all exercises (not fixed blocks) to the selected day. The
              target day&apos;s existing exercises will be replaced.
            </DialogDescription>
          </DialogHeader>
          <Select value={duplicateTarget} onValueChange={setDuplicateTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Select target day..." />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((name, idx) => (
                <SelectItem
                  key={idx}
                  value={String(idx)}
                  disabled={idx === selectedDay}
                >
                  {name}
                  {idx === selectedDay && " (current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={!duplicateTarget}
              className="gap-1.5"
            >
              <Copy className="h-4 w-4" />
              Copy Exercises
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
