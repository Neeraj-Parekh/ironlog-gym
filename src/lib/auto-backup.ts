// ============================================================
// Auto-backup — automatically download timestamped DB backup
// after each session, and request persistent storage
// ============================================================
import { createFullBackup, backupToJson } from "./db-backup";

/**
 * Request persistent storage to prevent the browser from
 * deleting IndexedDB when disk space is low or cache is cleared.
 * Chrome will show a prompt asking the user to allow.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  const isPersisted = await navigator.storage.persisted();
  if (isPersisted) return true;

  const granted = await navigator.storage.persist();
  if (granted) {
    console.log("[IronLog] Persistent storage granted — data protected from cache clearing");
  } else {
    console.warn("[IronLog] Persistent storage NOT granted — data may be cleared with cache");
  }
  return granted;
}

/**
 * Auto-download a timestamped backup of the entire database.
 * Called after each session completion.
 */
export async function autoDownloadBackup(): Promise<void> {
  try {
    const backup = await createFullBackup();
    const json = backupToJson(backup);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `ironlog-backup-${timestamp}.json`;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("[IronLog] Auto-backup failed:", e);
  }
}

/**
 * Check if this is the first visit and prompt for persistent storage.
 * Should be called on app mount.
 */
export async function initStorageProtection(): Promise<void> {
  await requestPersistentStorage();
}
