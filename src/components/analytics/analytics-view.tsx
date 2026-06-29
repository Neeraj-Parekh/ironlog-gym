"use client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Clock } from "lucide-react";

export function AnalyticsView() {
  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-bold text-lg mb-1">Analytics & Records</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Per-exercise volume trends, estimated 1RM progression, weekly
            aggregates, and progressive-overload velocity (growth vs plateau).
          </p>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4 pb-4 flex items-start gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Phase 4 — Analytics Engine
            </p>
            <p>
              Volume trend graphs (recharts), Epley 1RM estimates, rolling-window
              progressive-overload velocity, and session history with exportable
              records. Launches after the Active Workout HUD.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
