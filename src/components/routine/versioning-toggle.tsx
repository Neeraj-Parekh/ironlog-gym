"use client";
import { useAppStore } from "@/lib/store/app-store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Structural versioning toggle — controls whether routine edits
 * apply to "This Week Only" (deviation override) or
 * "All Future Weeks" (new immutable version).
 */
export function VersioningToggle() {
  const mode = useAppStore((s) => s.versioningMode);
  const setMode = useAppStore((s) => s.setVersioningMode);

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(v) => {
        if (v) setMode(v as typeof mode);
      }}
      className="rounded-lg border bg-muted/50 p-0.5"
    >
      <ToggleGroupItem
        value="this_week_only"
        className={cn(
          "h-7 px-2.5 text-[11px] font-medium rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm"
        )}
      >
        This Week
      </ToggleGroupItem>
      <ToggleGroupItem
        value="all_future_weeks"
        className={cn(
          "h-7 px-2.5 text-[11px] font-medium rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm"
        )}
      >
        All Future
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
