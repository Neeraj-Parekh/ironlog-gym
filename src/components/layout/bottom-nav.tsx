"use client";
import { useAppStore, type AppView } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";
import { CalendarDays, Dumbbell, Settings, BarChart3 } from "lucide-react";

const NAV_ITEMS: Array<{ view: AppView; label: string; icon: typeof CalendarDays }> = [
  { view: "week", label: "Routine", icon: CalendarDays },
  { view: "active_workout", label: "Workout", icon: Dumbbell },
  { view: "analytics", label: "Stats", icon: BarChart3 },
  { view: "settings", label: "Profile", icon: Settings },
];

/**
 * Bottom navigation — 3 primary tabs (thumb-zone centric).
 * AI Import, Stats, Body live under the Profile/Settings hub.
 * Sticky to viewport bottom as the footer.
 */
export function BottomNav() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  // Treat sub-views as belonging to their parent tab for highlight purposes
  const activeTab: AppView =
    view === "day_batch_edit"
      ? "week"
      : view === "active_session"
      ? "active_workout"
      : view === "ai_gateway" || view === "biometrics"
      ? "settings"
      : view;

  return (
    <nav
      className="sticky bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors",
                "min-h-[52px]",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                  active && "bg-accent scale-105"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
