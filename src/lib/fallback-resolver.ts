// ============================================================
// Fallback state machine — resolves alternative exercises
// when a station is busy. Follows the architect spec:
//   [Current Node] → Is Station Busy?
//     (No) → Execute
//     (Yes) → Fetch ordered fallback_ids
//             Find first where status == AVAILABLE
//             (Found) → Inject Alternative Node
//             (None) → Postpone to End of Queue
// ============================================================
import { getDB } from "@/lib/dexie";
import type { RoutineNode, Exercise, Equipment } from "@/lib/types";

export type FallbackResolution =
  | { kind: "available"; node: RoutineNode; exercise: Exercise }
  | { kind: "all_busy"; message: string }
  | { kind: "no_fallbacks"; message: string };

/**
 * Resolve the best fallback for a given routine node.
 * Checks both:
 * 1. Session-scoped busyNodeIds (user-marked this session)
 * 2. Equipment table current_status (persisted state)
 */
export async function resolveFallback(
  currentNode: RoutineNode,
  busyNodeIds: Set<string>
): Promise<FallbackResolution> {
  const fallbackIds = currentNode.fallback_ids ?? [];

  if (fallbackIds.length === 0) {
    return {
      kind: "no_fallbacks",
      message: `No fallback exercises linked to "${currentNode.name}". Deferring to end of session.`,
    };
  }

  const db = getDB();
  const exercises = await db.exercises.bulkGet(fallbackIds);
  const allEquipment = await db.equipment.toArray();

  for (let i = 0; i < fallbackIds.length; i++) {
    const ex = exercises[i];
    if (!ex) continue;

    // Check if this fallback's node was marked busy this session
    const fallbackNodeId = `${currentNode.id}_fb_${ex.id}`;
    if (busyNodeIds.has(fallbackNodeId)) continue;

    // Check if the fallback's equipment is BUSY in the DB
    if (ex.equipment_id && ex.equipment_id !== "none_bodyweight") {
      const equip = allEquipment.find((e) => e.id === ex.equipment_id);
      if (equip && equip.kind === "machine" && equip.current_status === "BUSY") {
        continue; // Skip this fallback, try next
      }
    }

    // Build a new routine node for the fallback
    const fallbackNode: RoutineNode = {
      ...currentNode,
      id: fallbackNodeId,
      exercise_id: ex.id,
      name: ex.name,
      exercise_type: ex.exercise_type,
      equipment_source: {
        type:
          ex.exercise_type === "machine"
            ? "machine"
            : ex.equipment_id === "none_bodyweight"
            ? "bodyweight"
            : "barbell",
        preferred_id: ex.equipment_id,
      },
      // Reset sets_override if the fallback is a different type
      sets_override: [],
    };

    return { kind: "available", node: fallbackNode, exercise: ex };
  }

  return {
    kind: "all_busy",
    message: `All alternatives occupied. Moving "${currentNode.name}" to end of session.`,
  };
}
