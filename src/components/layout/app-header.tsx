"use client";
import { useAppStore, type AppView } from "@/lib/store/app-store";
import { VersioningToggle } from "@/components/routine/versioning-toggle";
import { Dumbbell, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEW_TITLES: Record<AppView, string> = {
  week: "Weekly Routine",
  day_batch_edit: "Day Editor",
  settings: "Profile & Settings",
  ai_gateway: "AI Import / Export",
  analytics: "Analytics & Records",
  biometrics: "Body & Hydration",
  active_workout: "Active Workout",
  active_session: "Live Session",
};

// Sub-pages that should show a back-to-settings arrow
const SETTINGS_SUBPAGES: AppView[] = ["ai_gateway", "analytics", "biometrics"];

export function AppHeader() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const showVersioning = view === "week" || view === "day_batch_edit";
  const isSettingsSubpage = SETTINGS_SUBPAGES.includes(view);

  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isSettingsSubpage ? (
            <button
              onClick={() => setView("settings")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          ) : view === "day_batch_edit" ? (
            <button
              onClick={() => setView("week")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Routine</span>
            </button>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background shrink-0">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-none">IronLog</h1>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5 truncate">
                  {VIEW_TITLES[view]}
                </p>
              </div>
            </>
          )}
          {(isSettingsSubpage || view === "day_batch_edit") && (
            <div className="ml-2 min-w-0">
              <h1 className="text-base font-bold leading-none truncate">
                {VIEW_TITLES[view]}
              </h1>
            </div>
          )}
        </div>
        {showVersioning && <VersioningToggle />}
      </div>
    </header>
  );
}
