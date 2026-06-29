// ============================================================
// Zod schemas for AI-gateway import validation & sanitization
// Handles malformed AI output gracefully (per spec §2 ingestion matrix)
// ============================================================
import { z } from "zod";

export const exerciseTypeSchema = z.enum([
  "machine",
  "non-machine",
  "cardio",
  "stretching",
]);

export const equipmentKindSchema = z.enum([
  "barbell",
  "dumbbell",
  "plate",
  "machine",
  "bodyweight",
]);

// ---- Set entry (per-set target or logged) ----
export const setEntrySchema = z.object({
  set_index: z.number().int().min(1).default(1),
  weight_kg: z.number().min(0).default(0),
  reps_completed: z.number().int().min(0).default(0),
  target_reps: z.number().int().min(0).optional(),
  target_weight_kg: z.number().min(0).optional(),
});

// ---- Visual tag (optional in payload, derived if absent) ----
export const visualTagSchema = z.object({
  label: z.string().default(""),
  border_color: z.string().default("#EF4444"),
  bg_color: z.string().default("#FEF2F2"),
  icon_identifier: z.string().default("cpu"),
});

// ---- Single exercise node in AI import payload ----
export const exerciseNodeSchema = z.object({
  sequence: z.number().int().min(1).default(1),
  name: z.string().min(1, "Exercise name is required"),
  exercise_type: exerciseTypeSchema.default("non-machine"),
  equipment_id: z.string().default("none_bodyweight"),
  visual_tag: visualTagSchema.optional(),
  metrics: z
    .object({
      tracking_mode: z.string().optional(),
      sets: z.array(setEntrySchema).default([]),
      duration_minutes: z.number().optional(),
      intensity_metrics: z.record(z.string(), z.number()).optional(),
    })
    .default({}),
  fallback_ids: z.array(z.string()).default([]),
  is_fixed: z.boolean().default(false),
  block_type: z.enum(["pre", "exercise", "post"]).default("exercise"),
});

// ---- Full AI import payload (import_export_gateway.json shape) ----
export const importPayloadSchema = z.object({
  metadata: z
    .object({
      log_version: z.string().default("2.0"),
      timestamp_epoch: z.number().optional(),
      target_day_tags: z.array(z.string()).default([]),
    })
    .default({}),
  session_payload: z.object({
    day_identifier: z.string().default("imported_day"),
    day_label: z.string().optional(),
    exercises_logged: z.array(exerciseNodeSchema).default([]),
  }),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type ImportExerciseNode = z.infer<typeof exerciseNodeSchema>;
export type ImportSetEntry = z.infer<typeof setEntrySchema>;

// ---- Sanitization: parse + validate + normalize ----
export interface SanitizeResult {
  ok: boolean;
  data?: ImportPayload;
  error?: string;
  warnings: string[];
}

export function sanitizeAIImport(rawData: string): SanitizeResult {
  const warnings: string[] = [];

  // Step 1: safe JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch (e) {
    return {
      ok: false,
      error: `Malformed JSON: ${
        e instanceof Error ? e.message : String(e)
      }`,
      warnings,
    };
  }

  // Step 2: structural validation with zod (fills defaults, coerces)
  const result = importPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      error: `Schema validation failed: ${issues}`,
      warnings,
    };
  }

  const data = result.data;

  // Step 3: semantic checks
  if (data.session_payload.exercises_logged.length === 0) {
    warnings.push("No exercises found in payload — importing empty day.");
  }

  // Flag missing equipment_ids on machine-type exercises
  data.session_payload.exercises_logged.forEach((node, idx) => {
    if (
      node.exercise_type === "machine" &&
      (!node.equipment_id || node.equipment_id === "none_bodyweight")
    ) {
      warnings.push(
        `Exercise "${node.name}" (index ${idx}) is machine-type but has no equipment_id — will be auto-generated.`
      );
    }
  });

  return { ok: true, data, warnings };
}

// ---- Inventory schema (for inventory.json validation) ----
export const inventorySchema = z.object({
  gym_inventory: z.object({
    barbells: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          weight_kg: z.number(),
        })
      )
      .default([]),
    dumbbells: z
      .object({
        unit: z.string().default("kg"),
        available_pairs: z.array(z.number()).default([]),
      })
      .default({ unit: "kg", available_pairs: [] }),
    weight_plates: z
      .object({
        unit: z.string().default("kg"),
        pairs_available: z.record(z.string(), z.number()).default({}),
      })
      .default({ unit: "kg", pairs_available: {} }),
    machines: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          weight_type: z.enum(["pin_stack", "plate_loaded"]).default("pin_stack"),
          stack_increment_kg: z.number().optional(),
          max_weight_kg: z.number().optional(),
          base_weight_kg: z.number().optional(),
          current_status: z.enum(["AVAILABLE", "BUSY"]).default("AVAILABLE"),
        })
      )
      .default([]),
  }),
});

export type InventoryData = z.infer<typeof inventorySchema>;
