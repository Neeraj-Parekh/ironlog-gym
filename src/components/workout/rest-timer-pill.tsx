"use client";
import { useEffect, useRef, useState } from "react";
import { useActiveSessionStore } from "@/lib/store/active-session-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rest timer pill — small floating box (not full screen).
 * Uses absolute timestamps so it survives background tab suspension.
 * On completion: color-wave animation (if enabled) + optional haptics.
 *
 * Visibility state machine:
 * - Uses visibilitychange event to recompute remaining on tab refocus
 * - Logs completion time for missed-alert display
 */
export function RestTimerPill() {
  const {
    restTimer,
    adjustRest,
    stopRest,
    markRestCompleted,
    clearRestCompleted,
  } = useActiveSessionStore();
  const { hapticsEnabled, restNotificationStyle } = useSettingsStore();
  const [now, setNow] = useState(Date.now());
  const completedFiredRef = useRef(false);

  // Tick every 250ms while active
  useEffect(() => {
    if (!restTimer.active) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [restTimer.active]);

  // Recompute on tab refocus (visibilitychange)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Fire completion
  useEffect(() => {
    if (!restTimer.active || !restTimer.target_end) return;
    if (now >= restTimer.target_end && !completedFiredRef.current) {
      completedFiredRef.current = true;
      markRestCompleted();
      // Haptics
      if (
        hapticsEnabled &&
        (restNotificationStyle === "haptics" ||
          restNotificationStyle === "both")
      ) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    }
  }, [
    now,
    restTimer.active,
    restTimer.target_end,
    restNotificationStyle,
    hapticsEnabled,
    markRestCompleted,
  ]);

  // Reset completion flag when a new rest starts
  useEffect(() => {
    if (restTimer.active && !restTimer.completed) {
      completedFiredRef.current = false;
    }
  }, [restTimer.active, restTimer.completed]);

  if (!restTimer.active && !restTimer.completed) return null;

  const remainingMs = restTimer.target_end
    ? Math.max(0, restTimer.target_end - now)
    : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const totalSeconds = restTimer.duration_seconds || 1;
  const progress = restTimer.completed
    ? 1
    : Math.min(1, 1 - remainingMs / (totalSeconds * 1000));

  // Color shifts as rest progresses: amber → emerald as it completes
  const progressColor =
    progress < 0.5
      ? "#f59e0b" // amber
      : progress < 0.85
      ? "#84cc16" // lime
      : "#10b981"; // emerald

  return (
    <>
      {/* Color-wave side bar — only on completion, if enabled */}
      {restTimer.completed &&
        (restNotificationStyle === "color_wave" ||
          restNotificationStyle === "both") && (
          <div
            className="fixed inset-y-0 left-0 z-[60] pointer-events-none"
            aria-hidden
          >
            <div className="rest-wave h-full" />
          </div>
        )}

      {/* The pill itself */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border bg-card shadow-lg",
            restTimer.completed
              ? "border-emerald-500/40 ring-2 ring-emerald-500/30"
              : "border-border"
          )}
        >
          {/* Progress fill bar */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-300 ease-linear"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: restTimer.completed
                ? "#10b98115"
                : `${progressColor}15`,
            }}
          />

          <div className="relative flex items-center gap-2 p-3">
            {restTimer.completed ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                  <Check className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                    Rest complete
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {restTimer.duration_seconds}s rest ended
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 h-8"
                  onClick={() => {
                    stopRest();
                    clearRestCompleted();
                  }}
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                {/* -15s button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0 rounded-xl"
                  onClick={() => adjustRest(-15)}
                  aria-label="Subtract 15 seconds"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                {/* Timer display */}
                <div className="flex-1 text-center min-w-0">
                  <p
                    className="text-2xl font-bold tabular-nums leading-none"
                    style={{ color: progressColor }}
                  >
                    {Math.floor(remainingSeconds / 60)}:
                    {String(remainingSeconds % 60).padStart(2, "0")}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Rest · {restTimer.duration_seconds}s
                  </p>
                </div>

                {/* +15s button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0 rounded-xl"
                  onClick={() => adjustRest(15)}
                  aria-label="Add 15 seconds"
                >
                  <Plus className="h-4 w-4" />
                </Button>

                {/* Stop */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0 rounded-xl text-muted-foreground"
                  onClick={() => {
                    stopRest();
                    clearRestCompleted();
                  }}
                  aria-label="Stop rest timer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Local style for the color-wave animation */}
      <style jsx>{`
        :global(.rest-wave) {
          width: 12px;
          background: linear-gradient(
            180deg,
            #10b981 0%,
            #84cc16 25%,
            #f59e0b 50%,
            #84cc16 75%,
            #10b981 100%
          );
          background-size: 100% 200%;
          animation: rest-wave-anim 1.2s ease-out;
          box-shadow: 0 0 24px 4px rgba(16, 185, 129, 0.4);
        }
        @keyframes rest-wave-anim {
          0% {
            background-position: 0% 100%;
            transform: scaleY(0.3);
            opacity: 0.5;
          }
          50% {
            background-position: 0% 0%;
            transform: scaleY(1);
            opacity: 1;
          }
          100% {
            background-position: 0% 100%;
            transform: scaleY(1);
            opacity: 0.8;
          }
        }
      `}</style>
    </>
  );
}
