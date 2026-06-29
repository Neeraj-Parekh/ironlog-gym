"use client";
import { useEffect } from "react";

/**
 * Registers the service worker for PWA offline support.
 * Mounted in the root layout, client-only.
 * Enabled in both dev and prod for testing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  return null;
}
