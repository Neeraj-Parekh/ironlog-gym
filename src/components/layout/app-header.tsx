"use client";
import { useAppStore, type AppView } from "@/lib/store/app-store";
import { VersioningToggle } from "@/components/routine/versioning-toggle";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEW_TITLES: Record<AppView, string> = {
  week: "Weekly Routine",
  day_batch_edit: "Day Editor",
  ai_gateway: "AI Import / Export",
  analytics: "Analytics & Records",
  biometrics: "Body & Hydration",
  active_workout: "Active Workout",
};

/**
 * App shell header — shows app logo + current view title.
 * Hides the versioning toggle on views that don't need it.
 */
export function AppHeader() {
  const view = useAppStore((s) => s.view);
  const showVersioning = view === "week" || view === "day_batch_edit";

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">IronLog</h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              {VIEW_TITLES[view]}
            </p>
          </div>
        </div>
        {showVersioning && <VersioningToggle />}
      </div>
    </header>
  );
}
