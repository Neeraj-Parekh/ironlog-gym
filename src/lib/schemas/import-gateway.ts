// ============================================================
// Zod schemas for AI-gateway import validation & sanitization (v3)
// Handles malformed AI output gracefully (per spec §2 ingestion matrix)
// Supports: RPE, tempo, superset links, fallback details, compound flags
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
  // RPE (Rate of Perceived Exertion) 1-10
  rpe: z.number().min(0).max(10).optional(),
  // Tempo: 4-digit string e.g. "3010" = 3s eccentric, 0 pause, 1s concentric, 0 pause
  tempo: z.string().regex(/^\d{4}$/).optional(),
  // Rest after this specific set (overrides exercise default)
  rest_after_seconds: z.number().int().min(0).optional(),
  // Set type for logging
  set_type: z
    .enum(["working", "warmup", "dropset", "failure"])
    .optional()
    .default("working"),
});

// ---- Visual tag (optional in payload, derived if absent) ----
export const visualTagSchema = z.object({
  label: z.string().default(""),
  border_color: z.string().default("#EF4444"),
  bg_color: z.string().default("#FEF2F2"),
  icon_identifier: z.string().default("cpu"),
});

// ---- Detailed fallback entry (optional richer alternative to fallback_ids) ----
export const fallbackDetailSchema = z.object({
  exercise_id: z.string(),
  name: z.string().optional(),
  reason: z.string().optional(),
  priority: z.number().int().min(1).default(1),
});

// ---- Single exercise node in AI import payload ----
export const exerciseNodeSchema = z.object({
  sequence: z.number().int().min(1).default(1),
  name: z.string().min(1, "Exercise name is required"),
  exercise_type: exerciseTypeSchema.default("non-machine"),
  equipment_id: z.string().default("none_bodyweight"),
  target_muscle: z.string().optional(),
  is_compound: z.boolean().optional().default(false),
  visual_tag: visualTagSchema.optional(),
  metrics: z
    .object({
      tracking_mode: z.string().optional(),
      sets: z.array(setEntrySchema).default([]),
      duration_minutes: z.number().optional(),
      intensity_metrics: z
        .record(z.string(), z.number())
        .default({}),
    })
    .default({}),
  // Legacy: ordered list of exercise IDs
  fallback_ids: z.array(z.string()).default([]),
  // Rich: detailed fallback entries with reasons
  fallbacks_detail: z.array(fallbackDetailSchema).optional().default([]),
  // Superset partner (exercise name or sequence number)
  superset_with: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .default(null),
  fallback_ids_legacy: z.array(z.string()).optional(),
  is_fixed: z.boolean().default(false),
  block_type: z.enum(["pre", "exercise", "post"]).default("exercise"),
  notes: z.string().optional(),
});

// ---- Full AI import payload (v3 shape) ----
export const importPayloadSchema = z.object({
  metadata: z
    .object({
      log_version: z.string().default("3.0"),
      timestamp_epoch: z.number().optional().nullable(),
      target_day_tags: z.array(z.string()).default([]),
      source: z.string().default("ai_generated"),
      notes: z.string().optional(),
    })
    .default({}),
  session_payload: z.object({
    day_identifier: z.string().default("imported_day"),
    day_label: z.string().optional(),
    exercises_logged: z.array(exerciseNodeSchema).default([]),
  }),
});

// ---- Backwards-compatible v2 payload (auto-upgraded) ----
export const importPayloadV2Schema = z.object({
  metadata: z
    .object({
      log_version: z.string().optional(),
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
export type FallbackDetail = z.infer<typeof fallbackDetailSchema>;

// ---- Sanitization: parse + validate + normalize + upgrade ----
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

  // Step 3: semantic checks + cross-field normalization
  if (data.session_payload.exercises_logged.length === 0) {
    warnings.push("No exercises found in payload — importing empty day.");
  }

  data.session_payload.exercises_logged.forEach((node, idx) => {
    // Flag missing equipment_ids on machine-type exercises
    if (
      node.exercise_type === "machine" &&
      (!node.equipment_id || node.equipment_id === "none_bodyweight")
    ) {
      warnings.push(
        `Exercise "${node.name}" (index ${idx}) is machine-type but has no equipment_id — will be auto-generated.`
      );
    }

    // Merge fallbacks_detail into fallback_ids if both exist
    if (node.fallbacks_detail && node.fallbacks_detail.length > 0) {
      const detailIds = node.fallbacks_detail.map((f) => f.exercise_id);
      const existing = node.fallback_ids ?? [];
      const merged = [...new Set([...existing, ...detailIds])];
      if (merged.length !== existing.length) {
        node.fallback_ids = merged;
      }
    }

    // Warn if superset_with references a non-existent exercise
    if (
      node.superset_with !== null &&
      node.superset_with !== undefined &&
      typeof node.superset_with === "string"
    ) {
      const target = data.session_payload.exercises_logged.find(
        (e) => e.name.toLowerCase() === String(node.superset_with).toLowerCase()
      );
      if (!target) {
        warnings.push(
          `Exercise "${node.name}" references superset_with "${node.superset_with}" but no exercise with that name was found.`
        );
      }
    }

    // Validate tempo format
    if (node.metrics.sets) {
      node.metrics.sets.forEach((s) => {
        if (s.tempo && !/^\d{4}$/.test(s.tempo)) {
          warnings.push(
            `Exercise "${node.name}" set ${s.set_index}: tempo "${s.tempo}" is not 4 digits — ignored.`
          );
          s.tempo = undefined;
        }
      });
    }
  });

  return { ok: true, data, warnings };
}

// ---- Inventory schema (expanded v3) ----
export const inventorySchema = z.object({
  gym_inventory: z.object({
    barbells: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          weight_kg: z.number(),
          // Knurling intensity 1-3 (affects grip recommendation)
          knurling: z.number().min(1).max(3).optional(),
          // Bearing type affects spin
          bearing: z.enum(["bushing", "bearing", "needle"]).optional(),
        })
      )
      .default([]),
    dumbbells: z
      .object({
        unit: z.string().default("kg"),
        available_pairs: z.array(z.number()).default([]),
        // Max single dumbbell weight
        max_weight_kg: z.number().optional(),
      })
      .default({ unit: "kg", available_pairs: [] }),
    weight_plates: z
      .object({
        unit: z.string().default("kg"),
        pairs_available: z.record(z.string(), z.number()).default({}),
        // Plate material (affects durability)
        material: z
          .enum(["cast_iron", "bumper", "steel", "rubber_coated"])
          .optional(),
      })
      .default({ unit: "kg", pairs_available: {} }),
    machines: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          weight_type: z
            .enum(["pin_stack", "plate_loaded", "bodyweight"])
            .default("pin_stack"),
          stack_increment_kg: z.number().optional(),
          max_weight_kg: z.number().optional(),
          base_weight_kg: z.number().optional(),
          current_status: z.enum(["AVAILABLE", "BUSY"]).default("AVAILABLE"),
          // Physical location within gym
          zone: z.string().optional(),
          // Maintenance notes
          last_serviced: z.string().optional(),
          // Adjustable components
          adjustable: z
            .array(
              z.object({
                component: z.string(),
                positions: z.array(z.string()).default([]),
              })
            )
            .optional(),
        })
      )
      .default([]),
    // NEW: gym metadata
    gym_info: z
      .object({
        name: z.string().optional(),
        location: z.string().optional(),
        timezone: z.string().optional(),
        // Peak hours for smart scheduling
        peak_hours: z
          .array(
            z.object({
              day: z.number().min(0).max(6),
              start: z.string(),
              end: z.string(),
            })
          )
          .optional(),
      })
      .optional(),
  }),
});

export type InventoryData = z.infer<typeof inventorySchema>;
