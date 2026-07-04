"use client";
import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Screen Wake Lock — keeps the screen on during a workout.
 * Automatically reacquires when the tab becomes visible again.
 */
export function useWakeLock(active: boolean) {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<{ release(): Promise<void>; released: boolean } | null>(null);

  const acquire = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
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

  // Acquire when `active` becomes true, release when it becomes false or on unmount
  useEffect(() => {
    if (active) {
      acquire();
    } else {
      release();
    }
    return () => {
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
