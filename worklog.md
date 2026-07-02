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

---
Task ID: batch-all-features
Agent: main
Task: All missing/flagged features + gaps + training aids + polish (Android-only)

Work Log:

BATCH 1 — DATA RESILIENCE:
- Extended types.ts with: SessionSet RPE/tempo/set_type/notes, Biometric sleep/soreness/mood/readiness, PersonalRecord, Milestone, StreakRecord, RoutineTemplate
- Updated Dexie to v2 schema — added personal_records, milestones, streak, templates tables
- Created db-backup.ts — createFullBackup (13 tables), restoreFullBackup, purgeOldData (60-day window), hardResetDatabase
- Created data-management.tsx — Backup (copy/download), Restore, Purge, Hard Reset with confirmations
- Added DataManagementSection to Settings hub

BATCH 2 — HUD ENHANCEMENTS:
- logSet now accepts RPE/tempo/set_type/notes
- Created use-previous-session.ts — usePreviousSession + useWorkoutTimer hooks
- Created warmup-calc.ts — calculateWarmupSets (empty bar → 60% → 75% → 85% → 90%)
- Created haptics.ts — light/medium/heavy/success/error/select patterns
- Created sound.ts — Web Audio chime/beep/click
- Created hud-extras.tsx — RpeNotesSheet, PreviousSessionCard, WarmupCalcCard, ProgressionCard
- Updated HUD: workout timer, prev session card, progression card, warmup card, RPE badge, Add RPE button, haptic feedback, sound on rest

BATCH 3 — ROUTINE BUILDER:
- Added @dnd-kit drag-to-reorder (SortableExerciseRow with grip handle)
- Added duplicate-day dialog (copy exercises to any day)
- Added deload week button (60% volume, 85% weight, new version)
- Created exercise-catalog-dialog.tsx — search, edit, delete with confirmation
- Added deleteExercise() + updateExercise() helpers

BATCH 4 — ANALYTICS+:
- Created progression.ts — checkAndRecordPRs, updateStreak, checkMilestones, getProgressionSuggestion
- endAndPersistSession now auto-records PRs/streaks/milestones + shows celebration toasts
- Created achievements-panel.tsx — streak card, PR list, milestone grid
- Added session delete to History tab

BATCH 5 — RECOVERY:
- Created recovery-tracker.tsx — Sleep (4-10h), Soreness (1-5), Mood (emoji), Readiness (1-5)
- Water goal now dynamic: setting → bodyweight×35ml → 2500ml default

BATCH 6 — POLISH:
- Fallback resolver now checks equipment table current_status (not just session-scoped)
- Settings: sound toggle + type, water goal, progression toggle, warmup toggle
- Web Audio sound effects (no files needed)

Stage Summary:
- ALL flagged gaps fixed + ALL training aids + ALL polish added
- Browser-verified: backup, catalog, recovery, HUD (timer/RPE/warmup/progression), PRs, streaks, milestones, drag-reorder, duplicate-day, deload
- Lint: 0 errors, 0 warnings

---
Task ID: seed-physc-gym
Agent: sub-agent (general-purpose)
Task: Rewrite src/lib/seed.ts to replace the demo Push Day / Leg Day routine with the full Physc Gym 6-day training split + user biometrics

Work Log:
- Rewrote `src/lib/seed.ts` header comments to describe the new Physc Gym split + biometric seeding
- Added imports: `Biometric`, `EquipmentKind`, `EquipmentStatus`, `MachineWeightType` types from `@/lib/types`
- Kept `buildEquipment()` function unchanged (still pulls from inventory.json) but added `as MachineWeightType` / `as EquipmentStatus` casts on machine fields — fixes two pre-existing strict-TS errors that surfaced because `resolveJsonModule` infers JSON string fields as the wider `string` type
- Added `equipmentSourceFor(equipmentId)` helper that maps an equipment id back to a properly-typed `{ type: EquipmentKind; preferred_id?: string }` value (bar_* → barbell, dumbbell_* → dumbbell, mach_*/treadmill_* → machine, none_bodyweight → bodyweight). This removes the need for the old per-block `type: "barbell" as const` casts
- Replaced the 16-exercise demo catalog with a 39-exercise catalog (`EXERCISE_DEFS`) covering every move in the Physc Gym routine plus their fallback targets. Each exercise carries: id, name, target_muscle, exercise_type (machine/non-machine), equipment_id, ordered fallback_ids, and a derived visual_tag from `TAG_CONFIG`
- Exercise catalog highlights:
  - Legs: Squat, Lunges, Leg Press, Hack Squat (fallback), Seated Calf Raise, Leg Curl, Leg Extension
  - Shoulders: Overhead Press, Shoulder Press Machine, DB Shoulder Press (fallback), DB Lateral Raise, DB Front Raise, Rear Delt Cable Fly, DB Rear Delt Fly (fallback)
  - Back: Lat Pulldown Broad Grip, Lat Pulldown Narrow Grip (both linked to mach_lat_pulldown_01 as required), Cable Seated Row, T-Bar Row, Barbell Bent-Over Row (fallback), DB Shrugs, Barbell Shrug (fallback)
  - Biceps: EZ Bar Curl, DB Curl (fallback), Incline DB Curl, Preacher Curl Machine, Reverse Cable Curl
  - Chest: Barbell Bench Press, Incline DB Press, Decline Barbell Press, Seated Chest Press Machine (fallback), Pec Deck Fly, Cable Crossover (fallback), DB Fly (fallback), DB Pullover
  - Triceps: Cable Tricep Pushdown, Triceps Dip Machine (cable crossover primary — no dip machine in inventory), French Curl (EZ Bar Skull Crusher), DB Skull Crusher (fallback), Triceps Kickback
- Built `EXERCISE_MAP` lookup table from `EXERCISE_DEFS` so the routine builder can resolve name/type/fallbacks/equipment_source from a single exercise_id
- Replaced the old demo `buildRoutineNodes()` logic with a clean data-driven approach:
  - `ROUTINE_DAYS` array defines the 6 training days (Mon=Legs, Tue=Shoulders, Wed=Back, Thu=Biceps, Fri=Chest, Sat=Triceps) — each exercise is a `block()` call defaulting to 3 sets × 10 reps × 120s rest, empty `sets_override`
  - Loop iterates day 0→6; Sunday (no routine entry) gets a "Rest Day" label and is skipped (no pre/exercise/post nodes) per spec
  - Every training day: 1 fixed pre block ("Dynamic Warm-up & Joint Mobility", stretching, 8 min) → N exercise blocks (correct `exercise_type` per catalog entry, `fallback_ids` propagated, `equipment_source` derived) → 1 fixed post block ("Steady State Cardio", cardio, 22 min, intensity 4% incline @ 6 km/h)
  - Dropped the old `visual_tag: undefined as never` and `as RoutineNode` casts — the node literals now match `RoutineNode` cleanly without any cast (VisualTag is not part of RoutineNode)
- Added `buildBiometrics()` returning the three baseline entries:
  - Tier 2 height = 168 cm
  - Tier 1 body_weight = 59.3 kg
  - Tier 2 body_fat_pct = 14 %
- Updated `seedDatabase()`: routine version label changed from "Initial Routine" to "Physc Gym 6-Day Split"; transaction now includes `db.biometrics` and calls `db.biometrics.bulkPut(biometrics)` after the routine write
- `resetDatabase()` signature unchanged; it already cleared `db.biometrics` (kept as-is) and re-seeds via `seedDatabase()`

Stage Summary:
- `src/lib/seed.ts` fully rewritten — 788 lines, no TODOs, no placeholders
- Catalog: 39 exercises (28 in routine + 11 fallback-only entries)
- Routine: 6 training days × (1 pre + N exercises + 1 post) + 1 Sunday rest-day label
- 28 routine exercise nodes seeded across the week (Legs 6, Shoulders 4, Back 5, Biceps 4, Chest 5, Triceps 4)
- Biometrics: 3 baseline entries seeded (height, body_weight, body_fat_pct) with correct tiers
- Function signatures preserved: `seedDatabase(): Promise<void>` and `resetDatabase(): Promise<void>` — no consumer changes needed (`src/app/page.tsx` and `src/components/settings/data-management.tsx` continue to work as-is)
- TypeScript: zero errors on `src/lib/seed.ts` (`npx tsc --noEmit` reports no seed.ts issues)
- ESLint: clean — `npx eslint src/lib/seed.ts` returns no output (0 errors, 0 warnings)
- No React 19 effect/setState concerns (file is a pure data seeder with no React components)


---
Task ID: password-gate-physc-gym-logsheet
Agent: main
Task: Password gate (nero) + Physc Gym 6-day routine seed + Workout Log Sheet export with Energy/Difficulty/Cardio fields

Work Log:

PASSWORD GATE:
- Created `.env.local` with `APP_PASSWORD=nero`
- Created `src/proxy.ts` (Next.js 16 proxy convention, replaces deprecated middleware) — checks `ironlog-auth` cookie, returns inline HTML login page if missing
- Created `src/app/api/auth/route.ts` — POST handler verifies password, sets httpOnly cookie (30 day expiry); DELETE handler clears cookie
- Login page: dark theme, centered password input, error message on wrong password, auto-reload on success
- Verified: visiting URL shows login prompt, entering "nero" unlocks the app, cookie persists for 30 days

PHysC GYM ROUTINE SEED:
- Rewrote `src/lib/seed.ts` with full 6-day Physc Gym split (subagent task seed-physc-gym):
  - Monday: Legs (Squats, Lunges, Leg Press, Seated Calf Raise, Leg Curl, Leg Extension)
  - Tuesday: Shoulders (Overhead Press, Lateral Raises, Front Raises, Rear Delt Fly)
  - Wednesday: Back (Lat Pulldown Broad, Lat Pulldown Narrow, Seated Row, T-Bar Row, DB Shrugs)
  - Thursday: Biceps (Biceps Curl, Incline DB Curl, Preacher Curl, Reverse Cable Curl)
  - Friday: Chest (Flat Press, Incline Press, Decline Press, Pec Fly, DB Pullover)
  - Saturday: Triceps (Pushdown, Dip Machine, French Curl, Kickback)
  - Sunday: Rest Day
- Fixed pre-workout block: "Dynamic Warm-up & Joint Mobility" (8 min, stretching)
- Fixed post-workout block: "Steady State Cardio" (22 min, cardio)
- Seeded biometrics: Height 168cm (Tier 2), Weight 59.3kg (Tier 1), Body Fat 14% (Tier 2)
- 39 exercises in catalog with proper equipment mapping + fallback_ids

NEW SESSION FIELDS:
- Extended Session type with: energy_rating (1-10), difficulty_rating (1-10), cardio_machine, cardio_duration_min, cardio_distance
- Updated endAndPersistSession to accept sessionNotes + sessionMeta (energy/difficulty/cardio)
- Added UI inputs on session-complete screen:
  - Cardio section: Machine, Time (min), Distance/Steps text inputs
  - Energy: 1-10 button grid (emerald when selected)
  - Difficulty: 1-10 button grid (rose when selected)
  - Session notes textarea

LOG SHEET EXPORT:
- Created `src/lib/log-sheet-export.ts` — generateLogSheet (blank template for selected days), generateCompletedLogSheet (filled from session data)
- Format per user spec: Date, Day, exercise list with blanks (___ kg – 3 sets × 10 reps), Cardio section, Energy/Difficulty ratings
- Created `src/components/export/log-sheet-export-dialog.tsx` — day multi-select (checkboxes), generate button, copy + download options
- Added "Workout Log Sheet" button in Settings hub (sky-blue Calendar icon)

Stage Summary:
- Password gate: working (proxy.ts + API route + cookie), password "nero"
- Physc Gym routine: 6-day split seeded with 39 exercises + biometrics
- Log sheet export: generates printable templates with blanks for kg/sets/reps/cardio/energy/difficulty
- Session completion: Energy/Difficulty/Cardio inputs added
- Browser-verified: login prompt → password "nero" → app loads with Physc Gym 6-day split → log sheet export generates correct format
- Lint: 0 errors, 0 warnings

---
Task ID: seed-45-exercises
Agent: general-purpose
Task: Rewrite src/lib/seed.ts to include ALL 45 exercises from the Physc Gym master list + full warm-up/stretching routine

Work Log:
- Read worklog.md, current src/lib/seed.ts (788 lines, 39 exercises), src/lib/types.ts, src/lib/tags.ts (TAG_CONFIG), src/data/inventory.json (25 machines/barbells/dumbbells/plates)
- Verified only `src/lib/seed.ts` references the old exercise IDs (ex_squat, ex_ez_curl, ex_bench_press, etc.) — no other file depends on them, so the ID rename is safe
- Verified ESLint config: `no-unused-vars` and `@typescript-eslint/no-unused-vars` are off, so removing the unused `DAY_NAMES` constant is for cleanliness, not for lint compliance
- Rewrote `src/lib/seed.ts` (now 832 lines):
  - Updated header comment block to describe 45 exercises across 8 categories + new fixed-block names/durations
  - Removed unused `DAY_NAMES` constant (other files have their own copies)
  - Kept all existing helpers unchanged: `makeVisualTag`, `uid`, `getISOWeek`, `equipmentSourceFor` (comment expanded to list all cardio prefixes), `buildEquipment`
  - Rewrote `EXERCISE_DEFS` array with exactly 45 entries (was 39), grouped by muscle category:
    - Legs (8): ex_squats, ex_lunges, ex_step_up, ex_leg_press, ex_leg_curl, ex_straight_leg_calf_raises, ex_seated_calf_raises, ex_leg_extension
    - Back (10): ex_seated_rows, ex_bent_over_rows, ex_one_arm_rows, ex_lat_pulldown_broad, ex_lat_pulldown_narrow, ex_db_shrugs, ex_deadlift, ex_stiff_leg_deadlift, ex_tbar_row, ex_back_extension
    - Biceps (4): ex_biceps_curl, ex_incline_db_curl, ex_reverse_cable_curl, ex_preacher_curl
    - Chest (5): ex_decline_chest_press, ex_incline_chest_press, ex_pec_fly, ex_db_pullover, ex_flat_chest_press
    - Shoulders (5): ex_overhead_press, ex_lateral_raises, ex_front_raises, ex_upright_row, ex_rear_delt_fly
    - Triceps (6): ex_tricep_pushdown, ex_tricep_dip_machine, ex_tricep_machine, ex_tricep_kickback, ex_french_curl, ex_close_grip_pushups
    - Cardio (1): ex_cardio_general
    - Core (6): ex_situps, ex_crunches, ex_twisting_crunches, ex_leg_flexion, ex_plank, ex_reverse_crunches
  - Each exercise carries: id, name, target_muscle, exercise_type, equipment_id, ordered fallback_ids — all 45 IDs match the task spec exactly (verified via `rg -o 'id: "ex_[a-z_]+"' | sort -u | wc -l` → 45)
  - Sensible fallback chains wired throughout: e.g. Squats↔Leg Press, Lunges↔Step Up, broad/narrow pulldowns swap, flat/incline/decline chest press cross-link, Triceps Pushdown↔Triceps Machine↔French Curl, all 6 core exercises cross-link where movement patterns overlap
  - Equipment picks for "DB/BB" or "DB/BB/Machine" exercises: barbell primary for chest/back presses, dumbbell for DB Shrugs, EZ bar for Biceps Curl + French Curl, machine for Upright Row + Back Extension
  - New muscle values added: "calves" (calf raises), "cardio" (general cardio entry), "core" (the 6 ab exercises)
  - Updated `ROUTINE_DAYS` to match the exact spec:
    - Mon=Legs (6: Squats, Lunges, Leg Press, Seated Calf Raise, Leg Curl, Leg Extension)
    - Tue=Shoulders (4: Overhead Press, Lateral Raises, Front Raises, Rear Delt Fly)
    - Wed=Back (5: Lat Pulldown Broad, Lat Pulldown Narrow, Seated Rows, T-Bar Row, DB Shrugs)
    - Thu=Biceps (4: Biceps Curl, Incline DB Curl, Preacher Curl, Reverse Cable Curl)
    - Fri=Chest (5: Flat Press, Incline Press, Decline Press, Pec Fly, DB Pullover)
    - Sat=Triceps + Core (6: Triceps Pushdown, Triceps Dip Machine, French Curl, Triceps Kickback, Plank, Crunches)
    - Sun=Rest Day (no nodes, just label)
  - Updated fixed blocks in `buildRoutineNodes()`:
    - Pre-workout: renamed to "Joint Mobility & Dynamic Warm-up", duration bumped from 8 → 10 min (stretching)
    - Post-workout: renamed to "Cardio + Static Stretching" (was "Steady State Cardio"), duration bumped from 22 → 25 min (cardio), dropped the previous `intensity_metrics` field since the combined block now mixes cardio + stretching
  - Kept `buildBiometrics()` returning the same 3 baseline entries (Tier 2 height 168cm, Tier 1 body_weight 59.3kg, Tier 2 body_fat_pct 14%)
  - Kept `seedDatabase()` signature + routine version label "Physc Gym 6-Day Split" + transaction includes `db.biometrics.bulkPut()`
  - Kept `resetDatabase()` signature + clearing of all 9 tables (exercises/equipment/routine_versions/routine_nodes/day_labels/sessions/session_sets/biometrics/water_intake) + re-seed via `seedDatabase()`
- Verification:
  - `npx tsc --noEmit | grep "src/lib/seed.ts"` → no errors specific to seed.ts (other pre-existing errors in dexie.ts/use-wake-lock/etc. are unrelated)
  - `npx eslint src/lib/seed.ts` → exit 0, zero output (0 errors, 0 warnings)
  - `rg -c 'id: "ex_'` → 45 (exact match with spec)
  - Dev server still running healthy (curl localhost:3000 → 200)

Stage Summary:
- `src/lib/seed.ts` fully rewritten — 832 lines, no TODOs, no placeholders
- Catalog expanded from 39 → 45 exercises (the complete Physc Gym master list)
- Routine: 6 training days × (1 pre + N exercises + 1 post) + 1 Sunday rest-day label
- 30 routine exercise nodes seeded across the week (Legs 6, Shoulders 4, Back 5, Biceps 4, Chest 5, Triceps+Core 6) — the other 15 catalog entries serve as fallbacks or future manual-adds
- Fixed blocks updated: 10-min "Joint Mobility & Dynamic Warm-up" (stretching, pre) + 25-min "Cardio + Static Stretching" (cardio, post)
- Biometrics: 3 baseline entries seeded (Tier 2 height 168cm, Tier 1 body_weight 59.3kg, Tier 2 body_fat_pct 14%)
- Function signatures preserved: `seedDatabase(): Promise<void>` and `resetDatabase(): Promise<void>` — no consumer changes needed
- TypeScript: zero errors on src/lib/seed.ts
- ESLint: clean (0 errors, 0 warnings)
- All 45 exercise IDs verified to match the task spec exactly
