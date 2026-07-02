"use client";
import { useState } from "react";
import { generateLogSheet } from "@/lib/log-sheet-export";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Download, Check, Calendar } from "lucide-react";
import { toast } from "sonner";

export function LogSheetExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [numDays, setNumDays] = useState("7");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    const text = await generateLogSheet({
      startDate,
      numDays: Number(numDays),
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
    a.download = `ironlog-log-sheet-${startDate}.txt`;
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
            Workout Log Sheet
          </DialogTitle>
          <DialogDescription>
            Generate a date-wise log sheet. Completed sessions show actual data,
            planned days show blanks, rest days are marked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Number of days</Label>
            <Select value={numDays} onValueChange={setNumDays}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days (1 week)</SelectItem>
                <SelectItem value="14">14 days (2 weeks)</SelectItem>
                <SelectItem value="30">30 days (1 month)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
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
