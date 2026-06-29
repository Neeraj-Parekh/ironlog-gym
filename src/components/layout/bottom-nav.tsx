"use client";
import { useAppStore, type AppView } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Bot,
  Dumbbell,
  BarChart3,
  Droplets,
} from "lucide-react";

const NAV_ITEMS: Array<{ view: AppView; label: string; icon: typeof CalendarDays }> = [
  { view: "week", label: "Routine", icon: CalendarDays },
  { view: "ai_gateway", label: "AI Import", icon: Bot },
  { view: "active_workout", label: "Workout", icon: Dumbbell },
  { view: "analytics", label: "Stats", icon: BarChart3 },
  { view: "biometrics", label: "Body", icon: Droplets },
];

/**
 * Bottom navigation — sticky to viewport bottom (thumb-zone centric).
 * Acts as the sticky footer per layout rules.
 */
export function BottomNav() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  return (
    <nav
      className="sticky bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors",
                "min-h-[52px] touch-target",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  active && "bg-accent"
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
