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

---
Task ID: phases-3-4-5-theme-json-pwa
Agent: main
Task: Theme system (dark/light + 5 color schemas) + JSON schema v3 expansion + Phase 3 (Biometrics/Water) + Phase 4 (Analytics) + Phase 5 (Export) + PWA optimizations

Work Log:
- THEME SYSTEM:
  - Created `src/lib/theme-schemas.ts` — 5 color schemas (Iron=emerald, Ember=amber, Rose=pink, Ocean=teal, Violet=purple), each with light + dark variants defining primary/ring/accent/chart-1..5 CSS variables
  - Created `src/lib/store/theme-store.ts` — persisted theme store (mode: light/dark/system, colorSchema) via zustand persist
  - Created `src/components/theme/theme-applier.tsx` — applies CSS variables dynamically, listens for system theme changes, sets color-scheme for native controls
  - Created `src/components/theme/theme-controls.tsx` — schema picker (5 color circles) + Light/Dark/Auto toggle
  - Added ThemeApplier to root layout, ThemeControls to Settings hub under "Appearance" section

- JSON SCHEMA v3 EXPANSION:
  - Expanded blank-schema.json to v3 with: target_muscle, is_compound, RPE (1-10), tempo (4-digit e.g. "3010"), rest_after_seconds per set, set_type (working/warmup/dropset/failure), fallbacks_detail (exercise_id + name + reason + priority), superset_with, notes, block_type
  - Expanded inventory.json with: gym_info (name/location/timezone/peak_hours), barbell knurling + bearing type, dumbbell max_weight_kg, plate material, machine zone + adjustable components
  - Updated zod schemas to accept all new fields with safe defaults
  - Sanitizer now merges fallbacks_detail into fallback_ids, validates tempo format, warns on missing superset targets
  - AI portal preview now shows: Compound badge, target_muscle, max RPE, fallback count, superset indicator

- PHASE 3 — BIOMETRICS & WATER:
  - Created `src/hooks/use-biometrics.ts` — useWaterIntake (today's entries + total + add/remove), useWater24h (24h cumulative graph data), useBiometrics (all entries + addBiometric + getLatest + getHistory + daysSince)
  - Created `src/components/biometrics/water-tracker.tsx` — progress bar (2500ml goal), 4 quick-add buttons (250/500/750/1000ml), 24h cumulative area chart (recharts), today's log list with delete
  - Created `src/components/biometrics/biometric-prompts.tsx` — Tier-1 bodyweight card (prompts every 10 days, amber accent), Tier-2 body composition card (height/muscle mass/body fat %, prompts every 90 days, locks after save, violet accent)
  - Updated BiometricsView to use real components

- PHASE 4 — ANALYTICS:
  - Created `src/lib/analytics.ts` — computeTotalVolume, estimate1RM (Epley formula), bestSet, computeProgressiveOverload (Gv: growth/plateau/regression via rolling window comparison), summarizeSession, buildExerciseTrend
  - Created `src/hooks/use-analytics.ts` — useSessions (completed sessions with sets), useAllExercises, useLoggedExercises
  - Created `src/components/analytics/analytics-view.tsx` — 4 summary stat cards (sessions/sets/volume/best 1RM), 3 tabs:
    - Weekly: 8-week volume bar chart
    - Exercise: dropdown picker, progressive overload velocity card (growth=green/plateau=amber/regression=red with % change), volume trend area chart, estimated 1RM line chart
    - History: session cards with volume/sets/best 1RM/duration

- PHASE 5 — EXPORT ENGINE:
  - Created `src/lib/export-engine.ts` — generateSessionMarkdown (compact LLM-optimized format with volume, 1RM, bodyweight, weekly volume context, per-set table, system instruction for external AI), generateRoutineBackup (full JSON with version/nodes/exercises/equipment/day_labels)
  - Created `src/components/export/export-dialog.tsx` — Session MD / Routine JSON toggle, session picker, generate button, preview with copy-to-clipboard + download-as-file
  - Added "Export Data" tool button in Settings hub

- PWA OPTIMIZATIONS:
  - Created `src/hooks/use-wake-lock.ts` — Screen Wake Lock API integration (keeps screen on during active workout, auto-reacquires on tab refocus)
  - Integrated wake lock into ActiveSessionHUD (active while session running, releases on completion)
  - Enhanced service worker: navigation request handling, offline.html fallback page, stale-while-revalidate for assets
  - Created `public/offline.html` — styled offline fallback page
  - Generated PNG icons (192/512/180px) from SVG via sharp
  - Updated manifest with screenshots, shortcuts (Start Workout, Routine), display_override
  - Updated layout metadata with full icon set (SVG + 192 + 512 PNG), apple-touch-icon, formatDetection, mobile-web-app-capable
  - Enabled service worker in development (was production-only)

Stage Summary:
- Theme system: 5 color schemas × light/dark = 10 combinations, persisted, with system-auto mode
- JSON v3: AI can now generate richer payloads with RPE, tempo, superset links, compound flags, detailed fallbacks with reasons
- Phase 3: Water tracker with 24h graph + Tier-1/Tier-2 biometric prompts with time-gated locks
- Phase 4: Full analytics — volume trends, Epley 1RM estimates, progressive overload velocity, session history
- Phase 5: Dual export — clipboard Markdown for AI nutrition handoff + JSON routine backup
- PWA: Wake lock during workouts, offline fallback page, proper PNG icons, app shortcuts
- ALL verified via Agent Browser:
  - Theme switching (Iron/Ember/Rose/Ocean/Violet + dark mode) ✓
  - Water tracking (750ml logged, 1750ml remaining) ✓
  - Bodyweight logging (78kg, Tier-1) ✓
  - Complete workout session (4 sets Bench Press, 2560kg volume, 101.3kg 1RM) ✓
  - Analytics (summary cards + history + weekly chart) ✓
  - Export (Markdown with full session data + JSON routine backup) ✓
  - v3 schema import (Barbell Row with Compound badge, RPE 9, 1 fallback) ✓
- Lint passes clean (0 errors, 0 warnings)
- Dev server running healthy on port 3000
