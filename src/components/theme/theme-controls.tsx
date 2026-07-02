"use client";
import { useThemeStore, type ThemeMode } from "@/lib/store/theme-store";
import { COLOR_SCHEMAS } from "@/lib/theme-schemas";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

export function ThemeControls() {
  const mode = useThemeStore((s) => s.mode);
  const colorSchema = useThemeStore((s) => s.colorSchema);
  const setMode = useThemeStore((s) => s.setMode);
  const setColorSchema = useThemeStore((s) => s.setColorSchema);

  return (
    <div className="space-y-4">
      {/* Color schema picker — larger with preview swatches */}
      <div>
        <Label className="text-xs font-medium flex items-center gap-1.5 mb-2">
          <Palette className="h-3.5 w-3.5" />
          Color Schema
        </Label>
        <div className="grid grid-cols-5 gap-2">
          {COLOR_SCHEMAS.map((schema) => {
            const active = colorSchema === schema.id;
            return (
              <button
                key={schema.id}
                onClick={() => setColorSchema(schema.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 transition-all",
                  active
                    ? "border-foreground scale-105 shadow-md"
                    : "border-transparent hover:border-border"
                )}
                title={schema.description}
              >
                {/* Color preview swatch */}
                <div className="flex gap-0.5">
                  <div
                    className="h-8 w-2 rounded-l-full"
                    style={{ backgroundColor: schema.light.primary }}
                  />
                  <div
                    className="h-8 w-2"
                    style={{ backgroundColor: schema.light.accent }}
                  />
                  <div
                    className="h-8 w-2"
                    style={{ backgroundColor: schema.light["chart-1"] }}
                  />
                  <div
                    className="h-8 w-2"
                    style={{ backgroundColor: schema.light["chart-2"] }}
                  />
                  <div
                    className="h-8 w-2 rounded-r-full"
                    style={{ backgroundColor: schema.light["chart-3"] }}
                  />
                </div>
                <span className="text-[10px] font-medium">{schema.name}</span>
                {active && (
                  <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode toggle */}
      <div>
        <Label className="text-xs font-medium mb-2 block">Appearance</Label>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => {
            if (v) setMode(v as ThemeMode);
          }}
          className="grid w-full grid-cols-3 rounded-lg border bg-muted/50 p-0.5"
        >
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                className="flex items-center gap-1.5 h-9 text-xs font-medium rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
    </div>
  );
}
