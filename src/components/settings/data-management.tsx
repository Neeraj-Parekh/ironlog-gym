"use client";
import { useState } from "react";
import {
  createFullBackup,
  restoreFullBackup,
  backupToJson,
  parseBackup,
  hardResetDatabase,
  purgeOldData,
  type FullBackup,
} from "@/lib/db-backup";
import { resetDatabase } from "@/lib/seed";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Download,
  Upload,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  Database,
  Archive,
} from "lucide-react";
import { toast } from "sonner";

export function DataManagementSection() {
  const [showBackup, setShowBackup] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showPurge, setShowPurge] = useState(false);
  const [backupJson, setBackupJson] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleBackup = async () => {
    try {
      const backup = await createFullBackup();
      const json = backupToJson(backup);
      setBackupJson(json);
      toast.success(
        `Backup created: ${backup.stats.total_sessions} sessions, ${backup.stats.total_sets} sets`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(backupJson);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([backupJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ironlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup file downloaded");
  };

  const handleRestore = async () => {
    try {
      const backup = parseBackup(restoreText);
      await restoreFullBackup(backup);
      toast.success("Database restored successfully");
      setShowRestore(false);
      setRestoreText("");
      // Reload the app to refresh all data
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const handleHardReset = async () => {
    try {
      await hardResetDatabase();
      await resetDatabase();
      toast.success("Database reset and re-seeded");
      setShowReset(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  };

  const handlePurge = async () => {
    try {
      const result = await purgeOldData(60);
      toast.success(
        `Purged ${result.purgedSessions} old sessions (${result.purgedSets} sets)`
      );
      setShowPurge(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purge failed");
    }
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
        Data Management
      </h3>
      <Card>
        <CardContent className="pt-2 pb-2 divide-y">
          {/* Backup */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-sm font-medium">Full Backup</Label>
                <p className="text-xs text-muted-foreground">
                  Export everything to JSON for device migration
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => { handleBackup(); setShowBackup(true); }}>
              Backup
            </Button>
          </div>

          {/* Restore */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-sm font-medium">Restore from Backup</Label>
                <p className="text-xs text-muted-foreground">
                  Import a previous backup (replaces all data)
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRestore(true)}
            >
              Restore
            </Button>
          </div>

          {/* Purge old data */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Archive className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-sm font-medium">Purge Old Data</Label>
                <p className="text-xs text-muted-foreground">
                  Delete sessions older than 60 days to save space
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPurge(true)}
            >
              Purge
            </Button>
          </div>

          {/* Hard reset */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <Label className="text-sm font-medium text-destructive">
                  Hard Reset (Recovery)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Wipe everything and re-seed (for corrupted DB)
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowReset(true)}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup preview dialog */}
      <Dialog open={showBackup} onOpenChange={setShowBackup}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Full Database Backup
            </DialogTitle>
            <DialogDescription>
              Copy this JSON or download as a file. Use &quot;Restore&quot; on any
              device to migrate your data.
            </DialogDescription>
          </DialogHeader>
          {backupJson && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {backupJson.length.toLocaleString()} characters
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={handleDownload}
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto rounded-lg bg-muted p-2.5 text-[10px] font-mono max-h-64 whitespace-pre-wrap break-words">
                {backupJson.slice(0, 5000)}
                {backupJson.length > 5000 && "\n... (truncated for preview)"}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore dialog */}
      <Dialog open={showRestore} onOpenChange={setShowRestore}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Restore from Backup</DialogTitle>
            <DialogDescription>
              Paste your backup JSON below. This will{" "}
              <strong>replace all current data</strong>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Paste backup JSON here..."
            value={restoreText}
            onChange={(e) => setRestoreText(e.target.value)}
            className="min-h-[200px] font-mono text-xs flex-1"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestore(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={!restoreText.trim()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard reset confirmation */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Hard Reset Database?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL your data — sessions, sets,
              biometrics, routine, everything — and re-seed with the default
              starter routine. This cannot be undone. Make a backup first if you
              want to keep your data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardReset}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge confirmation */}
      <AlertDialog open={showPurge} onOpenChange={setShowPurge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge sessions older than 60 days?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all completed sessions and their logged sets that
              are older than 60 days. This frees up storage space but you
              won&apos;t be able to view those sessions in analytics anymore.
              Make a backup first if you want to preserve them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurge}>
              Purge Old Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
