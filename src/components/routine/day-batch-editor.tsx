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
import { ExerciseEditorRow } from "./exercise-editor-row";
import { AddExerciseDialog } from "./add-exercise-dialog";
import { VisualTagBadge } from "./visual-tag-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Lock, Plus, Save, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const { exercises } = useExercises();

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

      {/* Day header */}
      <div className="mb-4">
        <Label className="text-xs text-muted-foreground">Editing</Label>
        <Input
          value={dayLabel}
          onChange={(e) => {
            setDayLabel(e.target.value);
            setDirty(true);
          }}
          className="mt-1 h-12 text-lg font-bold"
          placeholder={`${DAY_NAMES[selectedDay]} routine`}
        />
      </div>

      {/* Fixed blocks (locked) */}
      {(preBlock || postBlock) && (
        <div className="mb-4 rounded-xl border border-dashed bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Lock className="h-3.5 w-3.5" />
            Fixed Recovery Blocks
          </div>
          <div className="space-y-2">
            {preBlock && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VisualTagBadge type="stretching" />
                  <span className="text-sm font-medium">{preBlock.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {preBlock.duration_minutes} min
                </span>
              </div>
            )}
            {postBlock && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VisualTagBadge type="cardio" />
                  <span className="text-sm font-medium">{postBlock.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {postBlock.duration_minutes} min
                  {postBlock.intensity_metrics?.speed_kmh &&
                    ` · ${postBlock.intensity_metrics.speed_kmh} km/h`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Exercises ({exerciseNodes.length})
        </h2>
      </div>

      <div className="space-y-3">
        {exerciseNodes.map((node, idx) => (
          <ExerciseEditorRow
            key={node.id}
            node={node}
            index={idx + 1}
            exercises={exercises}
            onUpdate={(patch) => updateNode(node.id, patch)}
            onDelete={() => deleteNode(node.id)}
          />
        ))}

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
      </div>

      {/* Add exercise button */}
      {exerciseNodes.length > 0 && (
        <Button
          onClick={() => setShowAdd(true)}
          variant="outline"
          className="w-full mt-3 gap-1.5 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Add Exercise Node
        </Button>
      )}

      {/* Add exercise dialog */}
      <AddExerciseDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        exercises={exercises}
        onSelect={addExercise}
      />
    </div>
  );
}
