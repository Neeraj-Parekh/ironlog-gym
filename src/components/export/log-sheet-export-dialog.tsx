"use client";
import { useState } from "react";
import { generateLogSheet } from "@/lib/log-sheet-export";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Copy, Download, Check, Calendar } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export function LogSheetExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleGenerate = async () => {
    if (selectedDays.length === 0) {
      toast.error("Select at least one day");
      return;
    }
    const text = await generateLogSheet({
      days: selectedDays as Array<
        0 | 1 | 2 | 3 | 4 | 5 | 6
      >,
    });
    setOutput(text);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ironlog-workout-sheet-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Workout Log Sheet Export
          </DialogTitle>
          <DialogDescription>
            Generate a printable log sheet with blanks for weight, sets, reps,
            cardio, energy, and difficulty. Select which days to include.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-xs font-medium">Select days</Label>
          <div className="grid grid-cols-2 gap-2">
            {DAYS.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-accent/50"
              >
                <Checkbox
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => toggleDay(day.value)}
                />
                <span className="text-sm">{day.label}</span>
              </label>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={selectedDays.length === 0}
            className="w-full gap-1.5"
          >
            <Calendar className="h-4 w-4" />
            Generate Log Sheet
          </Button>
        </div>

        {output && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {output.length} chars
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
            <pre className="flex-1 overflow-auto rounded-lg bg-muted p-2.5 text-xs font-mono max-h-64 whitespace-pre-wrap break-words">
              {output}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
