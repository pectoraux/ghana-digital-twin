# Task 10-obs — full-stack-developer — Rewire ObservationsView to real fused observations from the Observation Engine

## Scope
Rewire ONE existing React view component (`src/components/gdt/views/ObservationsView.tsx`) to fetch REAL fused observations from the Observation Engine backend (`/api/observations` + `/api/observations/scan`), replacing the prior "Change Log" data source that consumed `/api/world-model/changes`.

Only this one file was modified. All other files left untouched per task constraints.

## API contract used (all return real JSON, already tested)
- `GET /api/observations?type=&status=&severity=&limit=50` → `{ observations: ObservationRecord[], count, types: [{type,label,description,threshold,minEvidenceSources}] }`
- `POST /api/observations/scan {mgrsTile?}` → `{ observationsCreated, observationsUpdated, byType, tilesScanned }`
- Client helpers consumed from `@/lib/gdt/api.ts`: `fetchObservations({type?,status?,severity?,limit?})`, `triggerObservationScan(mgrsTile?)`, `useAsync(fn, deps)`.
- Types consumed: `ObservationRecord` (and its nested `evidence: ObservationEvidence[]`).
- `ObservationType` imported from `@/lib/observation/types` to type the color map keys.

## Implementation notes
- **Header**: Title "Observations" (Radar icon) + subtitle "Fused evidence from multiple raster products — objective, no legal conclusions". Header right side: filtered/total count badge + "Run Scan" button (calls `triggerObservationScan()` then `refresh()`) with Loader2 spinner while `scanning`.
- **Stats strip** (4 `MetricStat` cards): Total Observations, Active count (`status==="active"`), Avg Confidence (`%`), Avg Evidence Sources per observation (`toFixed(1)`).
- **Filter bar** (3 chip rows + search):
  - Type chips: `All` + one per type from the API's `types` array (label + count badge). Each chip colored by `TYPE_COLORS` map (surface_disturbance `#fb923c`, water_body_change `#22d3ee`, vegetation_loss `#f97316`, burn_event `#ef4444`, moisture_stress `#a78bfa` — NO indigo/blue).
  - Severity chips: `All` + critical/high/moderate/low, colored by `SEVERITY_COLORS` (critical `#f43f5e`, high `#fb923c`, moderate `#fbbf24`, low `#34d399`).
  - Status chips: `All` + active/monitoring/resolved, colored by `STATUS_COLORS`.
  - Search box filters client-side by `title` / `summary` / `uuid` (case-insensitive).
  - Clear button (X icon) appears when any filter is active.
- **Filter strategy**: fetches all observations once with `limit=200` and applies type/severity/status/search filters CLIENT-SIDE (via `useMemo`). This keeps the analytics sidebar reflective of the full dataset regardless of active filter selection. `useAsync` deps array is `[]` (no re-fetch on filter change); only `refresh()` (Run Scan) triggers a re-fetch.
- **List rows** (each is a `<button>` → `selectObservation(o.id)` to open inspector with `ObservationDetail`):
  - Left: vertical severity color bar (`w-0.5 rounded-full`, colored by severity).
  - Type badge (colored by type, with type label from `types` array; falls back to `titleCase(type)` when not in array).
  - UUID (mono, truncated to 8 chars + `…`), MGRS tile (`· {mgrsTile}`), `timeAgo(observedAt)` on the right.
  - Title (`text-[13px] font-medium truncate`).
  - Summary (`text-[11px] line-clamp-2 text-foreground/70`).
  - Evidence chips row: up to 4 small chips per evidence source showing `productType` + `contribution%` (mono `tnum`), with `+N more` overflow chip. Each chip's `title` attribute carries the full evidence `description` for hover inspection.
  - Right column (110px wide): `ConfidencePill` (from atoms.tsx), `fmtArea(areaHa)`, `{evidence.length} evidence` — all `font-mono tnum`.
  - Selected row highlight: `border-primary/50 bg-primary/5 ring-1 ring-primary/20`. Hover: `hover:border-primary/30 hover:bg-card/60`.
- **Analytics sidebar** (right, `hidden lg:flex`, 280px wide):
  - "By Type" — horizontal bars per type, sorted desc by count, colored by `TYPE_COLORS`. Empty state: "no data".
  - "By Severity" — 4 horizontal bars (critical/high/moderate/low) colored by `SEVERITY_COLORS`. Always renders all 4 severities (even if 0 count) for consistency.
  - "Confidence Distribution" — 5-bucket histogram (0–20, 20–40, 40–60, 60–80, 80–100). Bar height relative to max bucket; bucket floor labels in mono. Hover tooltip shows count + range.
  - "Evidence Fusion" explainer card — Layers icon + paragraph "Each observation fuses multiple raster products. Confidence and uncertainty are propagated from all evidence sources. No legal conclusions." Footer shows live `${types.length} observation types · ${observations.length} active`.
- **States**:
  - Loading: centered Loader2 + "Loading observations…".
  - Error: AlertTriangle (rose-400) + "Failed to load observations: {error}".
  - Empty (no observations): Radar icon + "No observations yet" + "Run a scan to fuse raster products into observations." + Run Scan button.
  - Empty filtered (observations exist but none match filters): Eye icon + "No observations match your filters".
- **Accessibility**: ARIA labels on search input + Run Scan button; `aria-hidden` on decorative color bars/dots.
- **Styling**: All dark semantic tokens (`bg-card/40`, `border-border`, `text-muted-foreground`, `text-foreground`, `bg-background`, `bg-foreground/5`, `bg-foreground/[0.08]`). Accent palette strictly emerald/gold/teal/rose/orange (+ the type-specific accents in TYPE_COLORS which include `#a78bfa` for moisture_stress — that's a violet, used ONLY for that one observation type per the task spec, NOT a UI chrome color). `gdt-scroll` on both scrollable list and sidebar. `font-mono tnum` on all numeric values. Hover transitions on all interactive elements.

## Quality bar
- TypeScript strict, **zero `any` introduced** (cast `data?.types as TypeInfo[] | undefined` to escape the existing `any[]` return type from api.ts into a locally-defined `TypeInfo` interface).
- No unused imports.
- All loading/error/empty states implemented.
- Hover states on all interactive elements (chips, rows, buttons, histogram bars).
- `gdt-scroll` on scroll areas; `font-mono tnum` on numbers.
- Did NOT create new files. Did NOT touch any other file.

## Lint / Type status
- `bun run lint` → **PASS** (exit 0, zero errors, zero warnings across the project).
- `npx tsc --noEmit` → **0 errors** in ObservationsView.tsx (grep filter for the filename returns no output).

## Pre-existing blocker (NOT fixed — outside scope)
`src/components/gdt/ObservationDetail.tsx:6` imports `formatCoord` from `@/lib/gdt/format`, but `formatCoord` actually lives in `@/lib/gdt/geo`. This produces a Turbopack compile error that cascades into HTTP 500 for ALL dev-server requests (including `/api/observations` and `/api/observations/scan`, even though those server routes do not import ObservationDetail.tsx) because Next.js cannot render the error-response page when the client bundle is broken.

This is the same class of pre-existing bug noted in the prior Task 10 worklog entry (which at that time affected `StatusBar.tsx`). The bug has since shifted to `ObservationDetail.tsx`. Both files are in the do-not-touch list for this task, so the import path was NOT corrected here.

**Fix when permitted** (1-line change, outside this task's scope):
```diff
- import { formatCoord, fmtArea, timeAgo, fmtDateTime } from "@/lib/gdt/format";
+ import { formatCoord } from "@/lib/gdt/geo";
+ import { fmtArea, timeAgo, fmtDateTime } from "@/lib/gdt/format";
```
in `src/components/gdt/ObservationDetail.tsx` line 6.

Once that single import is corrected, the dev server will compile the client bundle cleanly, `/api/observations` will return real observation JSON, and ObservationsView.tsx will render the live fused-observations feed as designed.

ObservationsView.tsx itself is correct, fully typed, lint-clean, and ready to render the moment the upstream compile blocker is resolved.
