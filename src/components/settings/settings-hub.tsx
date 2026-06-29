"use client";
import { useAppStore } from "@/lib/store/app-store";
import {
  useSettingsStore,
  type RestNotificationStyle,
} from "@/lib/store/settings-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  BarChart3,
  Droplets,
  Vibrate,
  Bell,
  Timer,
  ChevronRight,
  Settings as SettingsIcon,
  User,
  Palette,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeControls } from "@/components/theme/theme-controls";
import { useState } from "react";
import { ExportDialog } from "@/components/export/export-dialog";

const SUB_PAGES: Array<{
  view: "ai_gateway" | "analytics" | "biometrics";
  label: string;
  description: string;
  icon: typeof Bot;
  accent: string;
}> = [
  {
    view: "ai_gateway",
    label: "AI Import / Export",
    description: "Copy blank schema, paste AI-generated routines, validate & import",
    icon: Bot,
    accent: "text-violet-500 bg-violet-500/10",
  },
  {
    view: "analytics",
    label: "Analytics & Records",
    description: "Volume trends, 1RM estimates, progressive overload velocity",
    icon: BarChart3,
    accent: "text-emerald-500 bg-emerald-500/10",
  },
  {
    view: "biometrics",
    label: "Body & Hydration",
    description: "Water tracker, bodyweight prompts, locked biometric window",
    icon: Droplets,
    accent: "text-sky-500 bg-sky-500/10",
  },
];

const NOTIFICATION_OPTIONS: Array<{
  value: RestNotificationStyle;
  label: string;
  description: string;
}> = [
  { value: "color_wave", label: "Color Wave", description: "Animated side-bar wave (no sound/vibration)" },
  { value: "haptics", label: "Haptics", description: "Vibration pulse only" },
  { value: "both", label: "Both", description: "Color wave + vibration" },
  { value: "silent", label: "Silent", description: "No notification" },
];

export function SettingsHub() {
  const setView = useAppStore((s) => s.setView);
  const [showExport, setShowExport] = useState(false);
  const {
    hapticsEnabled,
    restNotificationStyle,
    defaultRestSeconds,
    autoStartRest,
    setHapticsEnabled,
    setRestNotificationStyle,
    setDefaultRestSeconds,
    setAutoStartRest,
  } = useSettingsStore();

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* Profile header */}
      <Card>
        <CardContent className="pt-6 pb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
            <User className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg leading-tight">IronLog</h2>
            <p className="text-xs text-muted-foreground">
              Gym session tracker · offline-first
            </p>
          </div>
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Sub-pages */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Tools
        </h3>
        <div className="space-y-2">
          {SUB_PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <button
                key={page.view}
                onClick={() => setView(page.view)}
                className="w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    page.accent
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{page.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {page.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {/* Export tool */}
          <button
            onClick={() => setShowExport(true)}
            className="w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-amber-500 bg-amber-500/10">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Export Data</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Session Markdown (for AI) or routine JSON backup
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>

      <ExportDialog open={showExport} onOpenChange={setShowExport} />

      {/* Appearance / Theme */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Appearance
        </h3>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Theme & Colors</span>
            </div>
            <ThemeControls />
          </CardContent>
        </Card>
      </div>

      {/* Workout preferences */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Workout Preferences
        </h3>
        <Card>
          <CardContent className="pt-2 pb-2 divide-y">
            {/* Haptics */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Vibrate className="h-4 w-4" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer">
                    Vibration / Haptics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Vibrate on rest-timer completion
                  </p>
                </div>
              </div>
              <Switch
                checked={hapticsEnabled}
                onCheckedChange={setHapticsEnabled}
              />
            </div>

            {/* Rest notification style */}
            <div className="py-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-medium">
                    Rest Completion Notification
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    How the app alerts you when rest ends
                  </p>
                </div>
              </div>
              <Select
                value={restNotificationStyle}
                onValueChange={(v) =>
                  setRestNotificationStyle(v as RestNotificationStyle)
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-start rest */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Timer className="h-4 w-4" />
                </div>
                <div>
                  <Label className="text-sm font-medium cursor-pointer">
                    Auto-start Rest Timer
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Start countdown after logging a set
                  </p>
                </div>
              </div>
              <Switch checked={autoStartRest} onCheckedChange={setAutoStartRest} />
            </div>

            {/* Default rest seconds */}
            <div className="py-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Timer className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-medium">
                    Default Rest Duration
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Used when an exercise has no prescribed rest
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={15}
                  value={defaultRestSeconds}
                  onChange={(e) =>
                    setDefaultRestSeconds(Number(e.target.value))
                  }
                  className="h-9 w-24 text-center font-semibold"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
                <div className="flex-1" />
                <div className="flex gap-1">
                  {[60, 90, 120, 180].map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDefaultRestSeconds(s)}
                    >
                      {s}s
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground text-center">
            IronLog · Phone-optimized gym tracker
            <br />
            Offline-first · No account needed · Data stays on device
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
