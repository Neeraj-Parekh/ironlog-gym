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
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { CardSkeleton } from "@/components/shared/empty-state";
import { Dumbbell, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTH_KEY = "ironlog-authenticated";

export default function Home() {
  const view = useAppStore((s) => s.view);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Check auth on initial render (no effect needed)
  const [authed, setAuthed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AUTH_KEY) === "true";
  });

  // Seed database only after authed
  useEffect(() => {
    if (!authed) return;
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
  }, [authed]);

  // ---- Auth gate ----
  if (!authed) {
    return <LoginScreen onAuthed={() => setAuthed(true)} />;
  }

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

  const renderView = () => {
    switch (view) {
      case "week":
        return (
          <ErrorBoundary>
            <WeekView />
          </ErrorBoundary>
        );
      case "day_batch_edit":
        return (
          <ErrorBoundary>
            <DayBatchEditor />
          </ErrorBoundary>
        );
      case "settings":
        return (
          <ErrorBoundary>
            <SettingsHub />
          </ErrorBoundary>
        );
      case "ai_gateway":
        return (
          <ErrorBoundary>
            <AIPortal />
          </ErrorBoundary>
        );
      case "active_workout":
        return (
          <ErrorBoundary>
            <ActiveWorkoutView />
          </ErrorBoundary>
        );
      case "active_session":
        return (
          <ErrorBoundary>
            <ActiveSessionHUD />
          </ErrorBoundary>
        );
      case "analytics":
        return (
          <ErrorBoundary>
            <AnalyticsView />
          </ErrorBoundary>
        );
      case "biometrics":
        return (
          <ErrorBoundary>
            <BiometricsView />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary>
            <WeekView />
          </ErrorBoundary>
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OnboardingOverlay />
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-2xl">{renderView()}</main>
      <BottomNav />
    </div>
  );
}

// ---- Login Screen ----
function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        localStorage.setItem(AUTH_KEY, "true");
        onAuthed();
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground text-background">
            <Dumbbell className="h-10 w-10" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">IronLog</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter password to access your gym tracker
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pl-10 h-12 text-center"
              autoFocus
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12"
            disabled={loading || !password}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              "Unlock"
            )}
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
