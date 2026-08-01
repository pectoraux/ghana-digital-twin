# Task 10 — full-stack-developer — Rewire 4 GDT views to real world-model API

## Scope
Rewire 4 existing React view components in the Next.js 16 GDT project to fetch REAL data from the world-model backend, replacing simulated data imports. Files modified (only these 4):
- `src/components/gdt/views/EntitiesView.tsx`
- `src/components/gdt/views/GraphView.tsx`
- `src/components/gdt/views/SourcesView.tsx`
- `src/components/gdt/views/ObservationsView.tsx`

## API contracts used (all return real JSON, already tested)
- `GET /api/world-model/entities?limit=2000` → `{entities: EntityRecord[], total, count, limit, offset}`
- `GET /api/world-model/graph` → `{nodes:[{id,label,kind,regionId,centroid}], edges:[{source,target,relation,inferredBy}]}`
- `GET /api/connectors` → `{sources: ConnectorInfo[], registeredConnectors: string[]}`
- `GET /api/health` → `{summary, entitiesByKind, sources, recentRuns, recentEvents}` (recentEvents: `{id,type,sourceId,entityId,message,level,createdAt}`)
- `GET /api/world-model/changes?since=ISO&limit=200` → `{changes:[{id,entityId,version,change,observedAt,confidence,source,entityName,entityKind}], count}`
- `POST /api/connectors/:id` (triggerSync) and `POST /api/connectors {all:true}` (triggerSyncAll)

Client helpers + `useAsync` hook consumed from `@/lib/gdt/api.ts`.

## Changes per file

### EntitiesView.tsx
- Replaced `import { ENTITIES } from "@/lib/gdt/entities"` with `useAsync(() => fetchEntities({limit:2000}), [])`.
- Adapted table columns to real `EntityRecord`: externalId (mono subtext), kind badge (ENTITY_META + `kindLabel` fallback for administrative_boundary/water_body/terrain_feature/land_cover_region), region via `REGIONS.find(regionId)`, ConfidenceBar, `currentVersion` (vN), `timeAgo(lastObserved)`, `areaKm2 ?? lengthKm` size.
- 4 MetricStat cards compute real counts by `type` (natural/infrastructure/administrative/human_activity).
- Sidebar "By Type"/"By Kind" counts derived from fetched array.
- Added Loader2 spinner + AlertTriangle error + empty-state. Removed unused `setView`.

### GraphView.tsx
- Replaced `GRAPH_NODES/GRAPH_EDGES` + `entityById/observationById` imports with `useAsync(() => fetchGraph(), [])`.
- Implemented `computeLayout()`: degree map across all edges → top-60 nodes by degree → edges filtered to visible set → grouped by kind → each kind on a concentric ring (smallest innermost r=55, ringSpacing=52, phase-staggered) in 960×660 canvas.
- `nodeColor` uses `entityColor(kind)`. Removed observation-node special-casing.
- Click any node → `selectEntity(id)`. Added "showing X/Y nodes · M/N edges" badge + "showing top 60 by degree" pill.
- Legend dynamically derived from visible kinds (top 6). NodeInspector shows degree/regionId/centroid + connections with relation+inferredBy.
- Kept pan/zoom/hover/select + relationships panel + zoom controls. Added loading/error/empty states.

### SourcesView.tsx
- Replaced `DATA_SOURCES/INGESTION_LOG` + `DataSource/SourceStatus` imports with two `useAsync` hooks: `fetchConnectors()` (cards) + `fetchHealth()` (log/vitals).
- 4 MetricStat cards → Total sources, Healthy, Live connectors, Total records (sum).
- ConnectorCard rewritten for `ConnectorInfo`: `statusColor()` extends SOURCE_STATUS_META with pending→#71717a; Live/Metadata badge (Radio/FileBox); category/resolution/storageType badges; lastSync via `timeAgo(lastSyncAt)` or "never"; freshness bar from lastSyncAt (log-scaled) for live sources; "metadata only — bulk ingest required" note for non-live.
- Per-card "Sync now" button (live only) → `triggerSync(sourceId)` then `refresh()`; shows Loader2 + "Syncing…" while `syncingId` matches or `status==='syncing'`.
- Header "Sync all" button → `triggerSyncAll()`.
- Pipeline Health chart uses real status counts (incl. pending). Ingestion Log timeline renders `recentEvents` with level→color/icon (info/warn/error) + sourceId→name lookup. System Vitals wired to real syncingCount/totalRecords/registeredConnectors/summary.totalEntities.

### ObservationsView.tsx
- Reframed as "Change Log" (title + subtitle "Entity version history — change detection (Observations) activates in Milestone 3").
- Replaced `OBSERVATIONS` import with `useAsync(() => fetchChanges(sinceIso(since), 200), [since])`.
- since selector (7d/30d/90d button group) re-fetches on change.
- List rows: entityKind badge (entityColor + kindLabel), version (vN), source, timeAgo(observedAt), entityName, change description (line-clamp-2), ConfidencePill, truncated entityId. Click → `selectEntity(entityId)`.
- 4 MetricStat cards: Total changes, Entities changed (unique entityId), Avg confidence, Most recent (timeAgo of latest observedAt).
- Replaced obs-type/status chips with Kind filter chips (derived from changes, top 10). Kept min-confidence Slider + search + sort (newest/confidence/version).
- Analytics sidebar: By Kind (entityColor bars), By Source (top 6), Confidence Distribution histogram (5 bins), summary card.
- Empty state: "No entity changes yet" + "Trigger sync" button → `triggerSyncAll()` then `refresh()`.

## Quality
- TypeScript strict, no new `any` (only consumed existing `any` from api.ts, cast to typed interfaces).
- No unused imports.
- All loading (Loader2 spinner) / error (AlertTriangle + message) / empty states implemented.
- Hover states on all interactive elements. `gdt-scroll` on all scroll areas. `font-mono tnum` on numbers.
- Dark semantic tokens only (bg-card/40, border-border, text-muted-foreground, text-foreground, bg-background, bg-foreground/5). Accent palette emerald/gold/teal/rose/orange only — NO indigo/blue.

## Lint / Type status
- `npx eslint` on the 4 files → **exit 0** (0 errors, 0 warnings).
- `npx tsc --noEmit` → **0 errors** in all 4 files.
- Full `bun run lint` shows only 2 pre-existing issues in NON-target files (EntityDetail.tsx setState-in-effect; api.ts unused eslint-disable directive) — both outside this task's scope.

## Pre-existing blocker (NOT fixed — outside scope)
`src/components/gdt/StatusBar.tsx:6` imports `formatCoord` from `@/lib/gdt/format`, but `formatCoord` lives in `@/lib/gdt/geo`. This causes HTTP 500 on `/` and blocks all preview. StatusBar.tsx is in the do-not-touch list, so it was NOT modified. The 4 view files in this task are correct and will render once StatusBar.tsx's import path is corrected (change `@/lib/gdt/format` → `@/lib/gdt/geo` for the `formatCoord` named import). The worklog (Task 15) records this was previously fixed, so it appears to have been reverted by later work.
