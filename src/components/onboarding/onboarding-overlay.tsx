"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dumbbell, Bot, Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDED_KEY = "ironlog-onboarded";

interface Slide {
  icon: typeof Dumbbell;
  title: string;
  description: string;
  accent: string;
  bullets?: string[];
}

const SLIDES: Slide[] = [
  {
    icon: Dumbbell,
    title: "Welcome to IronLog",
    description:
      "Your offline gym tracker. Build routines, log sessions, track recovery — all on your device, no account needed.",
    accent: "from-emerald-500 to-teal-600",
    bullets: [
      "Works fully offline",
      "Data stays on your phone",
      "No sign-up, no cloud",
    ],
  },
  {
    icon: Bot,
    title: "Build Routines with AI",
    description:
      "Don't type exercises manually. Copy a blank schema, paste it to any AI, tell it your workout, then import the filled JSON back.",
    accent: "from-violet-500 to-purple-600",
    bullets: [
      "Profile → AI Import to start",
      "AI fills sets, reps, weights, fallbacks",
      "Import to any day in one tap",
    ],
  },
  {
    icon: Flame,
    title: "Log & Track Everything",
    description:
      "During workouts: oversized buttons, rest timer, machine-busy fallback. After: PRs, streaks, soreness, vitality trends.",
    accent: "from-orange-500 to-red-600",
    bullets: [
      "Tap LOG SET — auto rest timer",
      "STATION BUSY → auto-swap fallback",
      "Vitality score tracks your T proxies",
    ],
  },
];

export function OnboardingOverlay() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(ONBOARDED_KEY);
  });
  const [slide, setSlide] = useState(0);

  const handleFinish = () => {
    localStorage.setItem(ONBOARDED_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  const current = SLIDES[slide];
  const Icon = current.icon;
  const isLast = slide === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur p-6">
      <button
        onClick={handleFinish}
        className="absolute top-4 right-4 text-sm text-muted-foreground hover:text-foreground z-10"
      >
        Skip
      </button>

      <div className="w-full max-w-sm space-y-6">
        <div
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-3xl mx-auto bg-gradient-to-br text-white shadow-xl",
            current.accent
          )}
        >
          <Icon className="h-12 w-12" />
        </div>

        <div className="flex items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === slide
                  ? "w-8 bg-foreground"
                  : "w-2 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>
          {current.bullets && (
            <ul className="text-left space-y-1.5 mt-4">
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={() => (isLast ? handleFinish() : setSlide(slide + 1))}
          >
            {isLast ? "Get Started" : "Next"}
          </Button>
          {slide > 0 && (
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => setSlide(slide - 1)}
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
