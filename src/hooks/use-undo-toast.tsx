"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";

interface PendingAction {
  id: string;
  message: string;
  undoFn: () => Promise<void>;
  timeoutId: ReturnType<typeof setTimeout>;
}

const PENDING_KEY = "ironlog-pending-undo";

/**
 * Undo toast — shows a 5-second toast with an undo button.
 * The action is executed immediately, but undo reverses it.
 * Usage: const undoId = showUndoToast("Session deleted", async () => { await restore() });
 */
export function useUndoToast() {
  const show = useCallback(
    (message: string, undoFn: () => Promise<void>, duration = 5000) => {
      const undoId = `undo_${Date.now()}`;
      toast(message, {
        duration,
        action: {
          label: (
            <span className="flex items-center gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </span>
          ),
          onClick: async () => {
            await undoFn();
            toast.success("Undone");
          },
        },
      });
      return undoId;
    },
    []
  );

  return { showUndo: show };
}
