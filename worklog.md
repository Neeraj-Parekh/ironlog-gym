# IronLog — Work Log

---
Task ID: phase-0-1
Agent: main
Task: Phase 0 (Foundation) + Phase 1 (Routine Architecture Builder)

Work Log:
- Installed `dexie@4.4.4` for IndexedDB persistent storage
- Created `src/lib/types.ts` — full domain model (Exercise, Equipment, RoutineVersion, RoutineNode, Session, SessionSet, Biometric, WaterIntake, DayLabel)
- Created `src/lib/dexie.ts` — Dexie database with 9 tables, singleton client-only
- Created `src/lib/tags.ts` — visual tag system (machine=red, free=green, cardio=blue, stretch=amber) with lucide icons
- Created `src/lib/schemas/import-gateway.ts` — zod schemas for AI import validation + `sanitizeAIImport()` function with safe defaults
- Created `src/lib/store/app-store.ts` — zustand store for view routing + versioning mode
- Created `src/lib/seed.ts` — database seeder (equipment from inventory.json, 16 exercises, 7-day scaffold with fixed cardio+stretch, demo Push Day + Leg Day)
- Created `src/data/inventory.json` — gym inventory seed (3 barbells, 16 dumbbell pairs, 7 plate denominations, 12 machines)
- Created `src/data/blank-schema.json` — blank AI import template
- PWA: `public/manifest.webmanifest`, `public/sw.js` (stale-while-revalidate), `public/icon.svg`, `src/components/pwa/service-worker-register.tsx`, `src/components/pwa/install-prompt.tsx`
- Updated `src/app/layout.tsx` — PWA manifest link, theme color, viewport (portrait, no-scale, cover), SW register, install prompt
- Created `src/hooks/use-routine.ts` — Dexie data hooks (useActiveVersion, useRoutineNodes, useDayLabels, useExercises, useEquipment) with reload-via-counter pattern to satisfy React 19 lint rules
- Created `src/components/layout/app-header.tsx` — sticky header with logo + view title + versioning toggle
- Created `src/components/layout/bottom-nav.tsx` — 5-tab thumb-zone nav (Routine, AI Import, Workout, Stats, Body), sticky to bottom as footer
- Created `src/components/routine/versioning-toggle.tsx` — This Week / All Future toggle
- Created `src/components/routine/visual-tag-badge.tsx` — color-coded exercise type badge
- Created `src/components/routine/week-view.tsx` — 7-day grid (Mon→Sun)
- Created `src/components/routine/day-card.tsx` — day card with date, label, exercise count, fixed blocks summary, tag preview
- Created `src/components/routine/day-batch-editor.tsx` — full-day editor with locked fixed blocks, exercise list, Save button (versioning-aware: "all_future_weeks" creates new immutable version, "this_week_only" edits in place)
- Created `src/components/routine/exercise-editor-row.tsx` — inline exercise editor (sets/reps/rest + collapsible advanced: per-set weight×reps overrides + fallback linking)
- Created `src/components/routine/add-exercise-dialog.tsx` — catalog search + custom exercise creation
- Created `src/components/ai-gateway/ai-portal.tsx` — copy blank schema, paste JSON, zod-validate, preview, select target day, import to Dexie
- Created stub views: `active-workout-view.tsx`, `analytics-view.tsx`, `biometrics-view.tsx` (Phase 2/3/4 placeholders)
- Created `src/app/page.tsx` — seeds DB on first load, routes between 6 views

Stage Summary:
- Phase 0 + Phase 1 complete and browser-verified
- All 8 locked design decisions implemented (Dexie-first, user-tapped busy, versioning toggle, 7-day scaffold, analytics math stubbed, plate-loading stubbed, biometric stubs, markdown export stubbed)
- AI import loop verified end-to-end: copy schema → paste JSON → validate → select day → import → auto-navigate to day editor with imported exercises
- Per-set targets verified: 80×8, 80×8, 85×6, 85×6 showing correctly for seeded Bench Press
- Lint passes clean (0 errors)
- Dev server running on port 3000, all routes return 200
- Mobile viewport (iPhone 14) verified via Agent Browser
- Sticky footer (bottom nav) confirmed at viewport bottom

---
Task ID: nav-refactor + phase-2
Agent: main
Task: Nav restructure (3-tab + Settings hub) + 3-state color button + Phase 2 Active Workout HUD with rest timer pill

Work Log:
- Created `src/lib/store/settings-store.ts` — persisted settings (hapticsEnabled, restNotificationStyle: color_wave|haptics|both|silent, defaultRestSeconds, autoStartRest) using zustand persist middleware to localStorage
- Updated `src/lib/store/app-store.ts` — added "settings" + "active_session" views, activeSessionId tracking
- Restructured `src/components/layout/bottom-nav.tsx` — 3 primary tabs (Routine, Workout, Profile) replacing the old 5-tab nav. AI Import, Analytics, Biometrics now live under the Profile hub. Sub-view highlighting (day_batch_edit→Routine, active_session→Workout, etc.)
- Created `src/components/settings/settings-hub.tsx` — Profile page with: profile header, 3 tool links (AI Import, Analytics, Body), Workout Preferences card (haptics toggle, notification style dropdown, auto-start rest toggle, default rest duration with quick presets 60/90/120/180s)
- Updated `src/components/layout/app-header.tsx` — back arrow for settings sub-pages (ai_gateway/analytics/biometrics) and day_batch_edit
- Refactored `src/components/routine/exercise-editor-row.tsx` — 3-state color cycling button:
  - Mode 0 (dull/muted): read-only display with sets/reps/rest summary + per-set target chips
  - Mode 1 (amber): light editing — sets/reps/rest inputs + per-set weight×reps overrides
  - Mode 2 (rose): heavy editing — inline rename, fallback linking, remove exercise
  Button cycles View→Tune→Edit on each tap, with color + ring intensity increasing per mode
- Created `src/lib/store/active-session-store.ts` — zustand store for the live workout state machine: session, queue (deep copy), currentIndex, loggedSets, busyNodeIds, restTimer (absolute timestamps). Actions: logSet, markStationBusy, deferCurrentToEnd, swapToFallback, skipCurrent, startRest/adjustRest/stopRest/markRestCompleted
- Created `src/lib/plate-calc.ts` — greedy plate-loading calculator with normalized plate keys (fixes "20.0" vs "20" string mismatch), nearest-lower/higher suggestions, resolveBarbellEquipment (prefers exercise's preferred bar, falls back to 20kg Olympic)
- Created `src/lib/fallback-resolver.ts` — fallback state machine: queries exercise.fallback_ids, finds first available, builds new RoutineNode for swap. Returns "available", "all_busy", or "no_fallbacks" resolution
- Created `src/lib/session-helpers.ts` — startSessionForDay (deep-copies plan_snapshot, persists Session to Dexie, launches HUD), endAndPersistSession (saves logged sets, marks session completed)
- Created `src/components/workout/rest-timer-pill.tsx` — floating pill (not full screen) with:
  - Absolute timestamp tracking (survives background tab suspension via visibilitychange event)
  - +/-15s adjustment buttons
  - Progress fill bar (amber→lime→emerald color shift)
  - Color-wave side bar animation on completion (configurable via settings)
  - Optional vibration on completion (configurable via settings)
  - "Rest complete" state with Done button
- Created `src/components/workout/set-inputs.tsx` — oversized weight/reps input component, keyed by nodeId for auto-reset on exercise change. Uses ref-based pattern to sync values to parent without setState-in-effect lint violations
- Created `src/components/workout/active-session-hud.tsx` — the main Phase 2 HUD:
  - Progress bar (exercises completed + total volume)
  - Current exercise card with name, tag, set counter, target hint, logged sets history
  - Oversized weight/reps inputs with ±2.5kg and ±1 rep buttons
  - Plate loading hint with nearest-achievable suggestions
  - LOG SET button (green, oversized, bottom)
  - STATION BUSY button (amber, triggers fallback state machine)
  - SKIP button (defers to next exercise)
  - Manual rest timer start/stop controls
  - Session complete screen with save
  - End session confirmation dialog
- Updated `src/components/workout/active-workout-view.tsx` — launches session via startSessionForDay, shows today's session + quick-start for other days

Stage Summary:
- Nav restructured to 3 tabs (Routine, Workout, Profile) — AI Import + Stats + Body moved under Profile hub
- 3-state color button working: View (dull) → Tune (amber, sets/reps/rest) → Edit (rose, rename/fallbacks/remove)
- Settings hub with haptics toggle, notification style (color_wave/haptics/both/silent), auto-start rest, default rest duration
- Phase 2 Active Workout HUD fully functional:
  - LOG SET verified: 80kg×8 logged, volume=640kg, set counter advanced
  - Rest timer pill: +/-15s adjustment verified (180s→195s), auto-starts on log
  - STATION BUSY fallback verified: Bench Press → Pec Deck Fly swap with FALLBACK badge
  - Plate loading verified: 80kg = 1×25kg + 1×5kg per side (correct with 20kg Olympic bar)
  - Color-wave notification + haptics configurable in settings
- Lint passes clean (0 errors, 0 warnings)
- Dev server running healthy on port 3000
- All features browser-verified via Agent Browser (iPhone 14 viewport)
