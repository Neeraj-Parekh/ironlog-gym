"use client";
import { useEffect, useState, useCallback, useRef } from "react";

// Minimal type defs for the Screen Wake Lock API (not in standard TS lib yet)
interface WakeLockSentinel {
  released: boolean;
  type: "screen";
  release(): Promise<void>;
  addEventListener(
    type: "release",
    listener: (this: WakeLockSentinel, ev: Event) => void
  ): void;
}
interface NavigatorWithWakeLock extends Navigator {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinel>;
  };
}

/**
 * Screen Wake Lock — keeps the screen on during a workout.
 * Automatically reacquires when the tab becomes visible again.
 */
export function useWakeLock(active: boolean) {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return false;
    try {
      const sentinel = await nav.wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        setIsLocked(false);
        wakeLockRef.current = null;
      });
      setIsLocked(true);
      return true;
    } catch {
      setIsLocked(false);
      return false;
    }
  }, []);

  const release = useCallback(async () => {
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  // Acquire when `active` becomes true
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (active) {
        await acquire();
      } else {
        await release();
      }
      // Cleanup on unmount or when `active` changes
      return () => {
        if (cancelled) return;
        cancelled = true;
        release();
      };
    })();
    return () => {
      cancelled = true;
      release();
    };
  }, [active, acquire, release]);

  // Reacquire on visibility change (wake lock is lost when tab is hidden)
  useEffect(() => {
    if (!active) return;
    const handler = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        acquire();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [active, acquire]);

  return { isLocked, acquire, release };
}
