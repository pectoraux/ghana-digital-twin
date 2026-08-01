# Task 11 — GroundTruthView.tsx (Ghana Digital Twin)

**Agent:** gdt-view-developer (Z.ai Code)
**Date:** Auto
**Status:** ✅ Complete — lint clean (exit 0)

## Objective

Build `/home/z/my-project/src/components/gdt/views/GroundTruthView.tsx` — a two-column view for the Ghana Digital Twin's "Ground Truth & Active Learning" surface. DARK theme, semantic tokens (`bg-card/40`, `border-border`, `text-muted-foreground`), accent palette limited to emerald / gold / teal / rose / orange / violet. NO blue / indigo.

## Inputs Read

- `src/lib/gdt/api.ts` — `fetchReviewQueue`, `populateReviewQueue`, `submitReview`, `fetchCalibration`, `generateBenchmark`, `fetchDriftAlerts`, `runDriftDetection`, and `ReviewQueueItem` / `ReviewQueueStats` types.
- `src/components/gdt/atoms.tsx` — `MetricStat`, `SectionLabel`, `StatusDot`, `ConfidenceBar`.
- `src/lib/gdt/format.ts` — `timeAgo`, `obsColor`, `OBS_META`.
- `src/app/api/calibration/route.ts` + `src/lib/groundtruth/calibration.ts` — confirmed response shape `{ current: CalibrationResult, history, benchmarks }` with `reliability` bins + `perHypothesis` breakdown.
- `src/app/api/drift/route.ts` + `src/lib/groundtruth/drift.ts` — confirmed `{ alerts, count }` with `type`, `metric`, `baselineValue`, `currentValue`, `driftMagnitude`, `threshold`, `description`, `detectedAt`.
- `src/components/gdt/views/ContinuousView.tsx` + `IntelligenceView.tsx` — matched layout conventions (header w/ MetricStat grid, scroll body `gdt-scroll`, right sidebar `w-[340px]` → adapted to requested `w-[320px]`).

## Implementation Summary

### Layout
- Outer: `flex h-full w-full`.
- Main: `flex min-w-0 flex-1 flex-col` with sticky header + `gdt-scroll` body.
- Right sidebar: `hidden w-[320px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex`.

### Main column contents
1. **Header** — title "Ground Truth & Active Learning" + 4 `MetricStat` cards:
   - Review Queue (needs-review count) — amber `#fbbf24`
   - Ground Truth (verified count) — emerald `#34d399`
   - Calibration (ECE %) — teal `#2dd4bf`
   - Drift Alerts (active count) — rose `#f43f5e`
2. **Action buttons** — "Populate Queue" (primary accent) + "Run Drift Check" (rose).
3. **Review Queue list** — each item shows priority badge (urgent=rose `#f43f5e`, high=amber `#fbbf24`, normal=emerald `#34d399`), observation type pill, title, confidence bar, uncertainty bar (violet), info-gain %, MGRS tile, assignee, Confirm/Reject buttons. Wrapped in `max-h-[28rem] gdt-scroll`.
4. **Calibration section** — 5 `MetricStat` cards (Brier=orange, ECE=teal, Precision=emerald, Recall=gold, F1=violet). Reliability diagram (5 bins, side-by-side bars for confidence=gold + accuracy=emerald, with reference dashed line, count beneath each bin). Optional per-hypothesis precision/recall breakdown. "Generate Benchmark" button (violet).
5. **Drift Alerts list** — type badge (distribution=violet, sensor=teal, seasonal=orange), metric name, description, baseline→current values, magnitude vs threshold (rose when exceeded, amber otherwise). `max-h-80 gdt-scroll`.

### Right sidebar contents
1. **Benchmark Reports** — period label, F1 (emerald), ECE (teal), coverage (amber) mini-grid per report; optional learning improvement delta.
2. **Active Learning explanation card** — amber-tinted card describing uncertainty × priority × information gain strategy.
3. **Calibration explanation card** — teal-tinted card explaining Brier, ECE, and reliability diagram semantics.

### Data fetching
- `useEffect` + `useState` (NOT `useAsync`). Used `Promise.resolve().then(() => { if (active) setLoading(true); })` pattern inside the effect with an `active` guard and cleanup, matching existing view conventions.
- Mutations (`populateReviewQueue`, `submitReview`, `runDriftDetection`, `generateBenchmark`) trigger targeted re-fetches (`reloadReview`, `reloadCalibration`, `reloadDrift`) instead of a full reload.

### Styling conventions
- Semantic tokens: `bg-card/40`, `bg-card/30`, `bg-card/20`, `border-border`, `text-muted-foreground`, `text-foreground/80`, `bg-foreground/5`, `bg-foreground/10`.
- Accent palette only: emerald `#34d399`, gold `#fbbf24`, teal `#2dd4bf`, rose `#f43f5e`, orange `#fb923c`, violet `#a78bfa`. NO blue / indigo used.
- Numbers wrapped in `font-mono tnum`.
- Scroll regions use `gdt-scroll`.
- Empty states use `border-dashed` placeholder cards.
- Lucide icons: `ShieldCheck`, `ListChecks`, `Gauge`, `Activity`, `Bell`, `Sparkles`, `FlaskConical`, `BarChart3`, `Brain`, `Target`, `TrendingUp`, `CheckCircle2`, `XCircle`, `Loader2`.

## Lint Result

```
$ cd /home/z/my-project && bun run lint
$ eslint .
EXIT=0
```

✅ No errors, no warnings.

## Files Touched

- Created: `/home/z/my-project/src/components/gdt/views/GroundTruthView.tsx` (≈600 lines).

## Notes for Follow-up Agents

- The view assumes `/api/review-queue`, `/api/calibration`, and `/api/drift` are wired up (they are — verified in `src/app/api/*`).
- `ReviewQueueStats.totalGroundTruth` is the source for the "Ground Truth verified" metric (the `groundTruth` field also exists but `totalGroundTruth` is the canonical cumulative count).
- The reliability diagram auto-fills 5 empty bins when the API returns no `reliability` data (e.g., when there are zero ground-truth records) so the layout stays stable.
- All async buttons have loading spinners via `Loader2` and `disabled:opacity-50`.
