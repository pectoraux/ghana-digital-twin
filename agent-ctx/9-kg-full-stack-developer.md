# Task 9-kg — full-stack-developer — Build KnowledgeGraphView + add Lineage panel to ObservationDetail

## Scope
Two React view components for the Ghana Digital Twin platform:
1. **CREATE** `src/components/gdt/views/KnowledgeGraphView.tsx` — Environmental Knowledge Graph view (interactive node-link SVG graph + right inspector panel).
2. **EDIT** `src/components/gdt/ObservationDetail.tsx` — ADD a collapsible "Observation Lineage" tree section between Provenance and Objectivity.

Only these two files were touched. All other files left unchanged per task constraints.

## API contracts consumed (all return real JSON)
- `GET /api/knowledge-graph` → `{ nodes: KnowledgeNodeRecord[], edges: KnowledgeEdgeRecord[] }` where each node has `{id, conceptId, label, category, description, color}` and each edge has `{id, from: KnowledgeNodeRecord, to: KnowledgeNodeRecord, relation, confidence, description}`.
- `GET /api/observations/:id/lineage` → `LineageNode` tree `{level, id, label, type, details: Record<string,any>, children?: LineageNode[]}` with levels: observation → evidence → raster_product → baseline → scene → cog → stac_item.
- Client helpers from `@/lib/gdt/api.ts`: `fetchKnowledgeGraph()`, `fetchLineage(id)`, `useAsync(fn, deps)`.
- Types: `KnowledgeGraph`, `KnowledgeNodeRecord`, `KnowledgeEdgeRecord`, `LineageNode`.

## File 1 — KnowledgeGraphView.tsx (NEW, ~470 lines)

### Layout
- Full-height flex: SVG graph canvas (`flex-1`) + right inspector panel (`w-[300px]`, `hidden lg:flex`).
- Canvas: 960×660 viewBox, `bg-[oklch(0.135_0.006_165)]` + `gdt-dot-bg opacity-50` overlay (matches GraphView).

### Graph layout (`computeLayout`)
- Groups nodes by `category` (cause, effect, indicator, condition, entity_type).
- Smallest group → innermost concentric ring (`baseR=75`, `ringSpacing=85`).
- Within each ring, nodes distributed in a circle with per-ring phase stagger (`ringIdx * π/4`).
- Degree map computed across all edges (both endpoints counted).

### Node rendering
- Circle radius **16-22 by degree** (≥5→22, ≥3→20, ≥1→18, 0→16).
- Filled with `node.color`: outer halo at 22% opacity + ring stroke + inner solid dot.
- Label below (truncate at 22 chars).
- Dashed focus ring (`r+6`) when hovered or selected.

### Edge rendering
- Line between nodes; color via `edgeColor(relation)`:
  - emerald `#34d399` for `causes` / `often_precedes`
  - teal `#2dd4bf` for `correlates_with` / `affects`
  - rose `#f43f5e` for `may_threaten`
  - neutral gray `#71717a` for `is_a` / `negatively_correlates` / `may_indicate`
- Opacity = `0.25 + confidence * 0.55` (so confidence 0.55→~0.55, confidence 0.95→~0.77).
- Relation label rendered at midpoint (font-mono, color-matched) when an edge is focused.

### Pan / zoom (same pattern as GraphView reference)
- Wheel zoom (scale clamped 0.6–3.5), anchored at cursor position via `getScreenCTM().inverse()`.
- Pointer-drag pan (`dragStart` ref stores starting SVG-space point + initial translate).
- Zoom `+` / `−` buttons and reset (`Maximize2`) button bottom-right.

### Hover / select
- `onPointerEnter` on node → sets `hovered` + shows a `fixed`-position tooltip following the cursor (`onPointerMove` updates position) with the node's `description`.
- `onPointerLeave` clears hover + tooltip.
- Click node → `setSelected(id)`.
- `focus = hovered ?? selected`. `connectedSet` = focus node + all adjacent nodes. Non-connected nodes dimmed to 0.2 opacity; non-connected edges to 0.06.

### Right inspector panel
- **Default (no selection)**: Categories legend (color dot + capitalized name + count), Relation Types legend (color bar + relation + count), 2-col stats grid (nodes/edges count), explanation card with exact spec text: "This graph represents domain knowledge — conceptual relationships between environmental concepts. Separate from the World Model which represents physical entities."
- **Node selected**: NodeInspector card shows category badge (colored by node.color), label, description, `degree` + `conceptId` (mono), then Connections list. Each connection row shows the other node's color dot + label + relation arrow (`→` for out, `←` for in) + confidence %. Clicking a connection selects that node.
- Header has "× overview" button to deselect when a node is focused.

### Header bar (top-left)
- Title "Environmental Knowledge Graph" + subtitle "Domain concepts and conceptual relationships".
- Below: badge with `{nodes.length} nodes · {edges.length} edges` (mono tnum).

### States
- Loading: centered `Loader2` spinner + "Loading knowledge graph…".
- Error: `AlertTriangle` (rose-400) + "Failed to load knowledge graph: {error}".
- Empty: `Network` icon + "No domain concepts defined yet."

## File 2 — ObservationDetail.tsx (EDITED, +200 lines, 0 removed)

### New imports added
- `useCallback` from `react`.
- `fetchLineage`, `type LineageNode` from `@/lib/gdt/api`.
- `fmtDateTime` from `@/lib/gdt/format`.
- `GitBranch`, `ChevronDown`, `Loader2` from `lucide-react`.
- **Preserved**: existing `formatCoord` import from `@/lib/gdt/geo` (NOT changed per task warning).

### New constants / helpers (module scope)
- `LINEAGE_LEVEL_COLORS` map: observation=`#34d399` (emerald), evidence=`#fbbf24` (gold), raster_product=`#2dd4bf` (teal), baseline=`#a78bfa` (violet), scene=`#f43f5e` (rose), cog=`#f59e0b` (amber), stac_item=`#94a3b8` (blue-gray/slate).
- `lineageLevelColor(level)` — fallback `#a1a1aa`.
- `lineageDetails(level, details)` — defensive per-level key picker (casts `Record<string, any>` → `Record<string, unknown>`, extracts known keys per level via a `num()` coercion helper). Returns `[{label, value}]` array.
- `truncateHref(href, max=48)` — truncates COG hrefs for display.

### New components
- `LineageNodeRow` (recursive): 16px-per-level indent (`paddingLeft: depth * 16`). For nodes with children: a chevron toggle button (`ChevronRight` → rotates to `ChevronDown` when expanded, with `aria-expanded` + `aria-label`). For leaf nodes: a small color dot. Then a level badge (colored by level, uppercase, mono) + node label, followed by detail key/value pairs in mono tnum. Recursively renders `node.children` when expanded.
- `LineageTree` (wrapper): `useState<Set<string>>` initialized to `{root.id} ∪ {root.children[].id}` so observation + first level expanded by default, deeper levels collapsed. `toggle(id)` via `useCallback`. Renders `<LineageNodeRow node={root} depth={0} ... />` inside a `rounded-lg border bg-card/40 p-2` container.

### ObservationDetail component changes
- Added `lineage` + `lineageLoading` state.
- Added second `useEffect` (deps `[id]`) calling `fetchLineage(id)`. Uses `Promise.resolve().then(() => { if (active) { setLineage(null); setLineageLoading(true); } })` deferral pattern (matching the existing `fetchObservation` effect) to satisfy the `react-hooks/set-state-in-effect` ESLint rule.
- Inserted "Observation Lineage" `<div>` section between the Provenance section and the Objectivity section. Three render states:
  - **loading**: `Loader2` spinner + "Tracing provenance chain…".
  - **loaded**: `<LineageTree key={lineage.id} root={lineage} />` (key forces remount on observation change so default-expand state resets) + spec note "Full provenance chain from observation to original satellite COG. Every transformation is traceable."
  - **unavailable**: italic "Lineage unavailable for this observation.".

### What was NOT touched
- All existing ObservationDetail content (header, summary, key metrics, fused confidence, evidence fusion, affected entities, version history, provenance, objectivity, Fact helper) preserved verbatim.
- All existing imports kept (including pre-existing `X` and `toggleInspector` which were already there).

## Quality bar
- TypeScript strict, **zero `any` introduced** (LineageNode.details consumed as `Record<string, unknown>`).
- No new unused imports.
- All loading / error / empty states implemented on KnowledgeGraphView.
- Hover states on all interactive elements (legend rows, connection buttons, zoom controls, expand chevrons).
- `gdt-scroll` on the inspector panel scroll area.
- `font-mono tnum` on all numeric values (degree, confidence %, counts, href, signal %).
- Dark semantic tokens only (`bg-card/40`, `border-border`, `text-muted-foreground`, `text-foreground`, `bg-background/40`, `bg-foreground/5`, `bg-foreground/10`, `bg-card/85`, `bg-card/20`).
- Accent palette strictly emerald / gold / teal / rose / orange / amber / violet / slate — **NO indigo, NO saturated blue**.

## Lint / Type status
- `bun run lint` → **PASS** (exit 0, 0 errors, 0 warnings across the entire project). The single initial error (`react-hooks/set-state-in-effect` on `setLineage(null)` called synchronously in effect body) was fixed by deferring the state reset through `Promise.resolve().then(() => { if (active) {...} })`, matching the existing `fetchObservation` effect pattern.
- `npx tsc --noEmit` → **0 errors** in `KnowledgeGraphView.tsx` and `ObservationDetail.tsx`. All 9 remaining tsc errors are in pre-existing files outside this task's scope:
  - `src/lib/gdt/observations.ts` (5 errors: boolean not assignable to string|number)
  - `src/lib/gdt/store.ts` (1 error: missing hoveredEntityId/hoveredObservationId)
  - `src/lib/temporal/lineage.ts` (1 error: commonName property access)
  - `src/lib/worldmodel/connector-framework.ts` (1 error: coordinates on GeometryCollection)
  - `src/lib/worldmodel/geometry.ts` (2 errors: coordinates on GeometryCollection)

## Pre-existing blocker (NOT fixed — outside scope)
`src/components/gdt/Shell.tsx:12` imports `./views/PhenomenaView` which does not exist on disk. This breaks the client bundle and causes HTTP 500 on ALL routes (including `/api/observations/:id/lineage` and `/api/knowledge-graph`), because Next.js cannot render the error-response page when the client bundle is broken.

Shell.tsx is in the do-not-touch list, so the import was NOT modified. **KnowledgeGraphView.tsx itself is correctly imported at `Shell.tsx:15`** and will render the moment the `PhenomenaView` import is resolved by whoever owns Shell.tsx (either by creating `PhenomenaView.tsx` or by removing the import).

This is the same class of pre-existing compile-blocker noted in prior Task 10 / 10-obs agent-ctx records (which at those times affected `StatusBar.tsx` and `ObservationDetail.tsx` import paths respectively). The bug has shifted to `Shell.tsx`. Both files in this task are correct, fully typed, lint-clean, and ready to render the moment the upstream compile blocker is resolved.

## Verification
- `KnowledgeGraphView.tsx` exists at `src/components/gdt/views/KnowledgeGraphView.tsx` and is importable (confirmed via dev.log: `Shell.tsx:15` imports it without a module-not-found error for this file — only `PhenomenaView` at line 12 is missing).
- `ObservationDetail.tsx` retains all original sections in original order; the new Lineage section is inserted between Provenance and Objectivity as required.
