"use client";
import { useEffect, useState } from "react";
import { seedDatabase } from "@/lib/seed";
import { useAppStore } from "@/lib/store/app-store";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WeekView } from "@/components/routine/week-view";
import { DayBatchEditor } from "@/components/routine/day-batch-editor";
import { AIPortal } from "@/components/ai-gateway/ai-portal";
import { ActiveWorkoutView } from "@/components/workout/active-workout-view";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { BiometricsView } from "@/components/biometrics/biometrics-view";
import { SettingsHub } from "@/components/settings/settings-hub";
import { ActiveSessionHUD } from "@/components/workout/active-session-hud";
import { Loader2 } from "lucide-react";

export default function Home() {
  const view = useAppStore((s) => s.view);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await seedDatabase();
        setReady(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to initialize database"
        );
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-destructive font-medium mb-2">
          Initialization Error
        </p>
        <p className="text-xs text-muted-foreground font-mono">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading IronLog...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-2xl">
        {view === "week" && <WeekView />}
        {view === "day_batch_edit" && <DayBatchEditor />}
        {view === "settings" && <SettingsHub />}
        {view === "ai_gateway" && <AIPortal />}
        {view === "active_workout" && <ActiveWorkoutView />}
        {view === "active_session" && <ActiveSessionHUD />}
        {view === "analytics" && <AnalyticsView />}
        {view === "biometrics" && <BiometricsView />}
      </main>
      <BottomNav />
    </div>
  );
}
