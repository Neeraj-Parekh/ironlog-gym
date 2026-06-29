"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, Clock } from "lucide-react";

export function BiometricsView() {
  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
            <Droplets className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-bold text-lg mb-1">Body & Hydration</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Persistent water tracker (+250ml / +500ml bubble), 24h intake graph,
            Tier-1 bodyweight prompts (2–4×/month), and Tier-2 locked biometric
            window (height, muscle mass, body fat % every N months).
          </p>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4 pb-4 flex items-start gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Phase 3 — Biometrics & Water
            </p>
            <p>
              Water bubble widget with 24h line graph, bodyweight prompt cards,
              locked biometric form with alarm-based weight editing. Launches
              after the Active Workout HUD.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
