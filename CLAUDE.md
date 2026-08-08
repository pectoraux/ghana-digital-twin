# CLAUDE.md

Guidance for AI assistants working in this repository. Read this before making changes.

## What this project is

**Ghana Digital Twin (GDT)** — a Next.js 16 application that models the Republic of Ghana as a
continuously-updating geospatial world model. It ingests satellite/SAR/rainfall/cadastre data,
detects anomalies against seasonal baselines, generates ranked Bayesian hypotheses (illegal mining,
deforestation, flooding, cocoa disease, land-use change), plans community verification missions, and
feeds verified outcomes back as ground truth for calibration.

It is a **single-page client app** (`/` renders one shell, views switch in the Zustand store) sitting
on **259 API routes** and a **224-model Prisma schema** on PostgreSQL (Neon).

The end-to-end pipeline:

```
Connectors → Pipeline (ingest) → Raster Products (spectral indices)
  → Observation Engine (anomaly vs baseline) → Intelligence Engine (25 Bayesian rules, 9 hypotheses)
  → Mission Planner (EVI-ranked) → Community verification (photo + witness)
  → Calibration Loop (auto-confirm → GroundTruth → computeCalibration)
```

## Commands

Package manager is **bun** (`bun.lock` is committed; there is no `package-lock.json`).

```bash
bun install                    # postinstall runs `prisma generate`
bun run dev                    # next dev on :3000, tees output to dev.log
bun run lint                   # eslint . — the primary quality gate
bunx tsc --noEmit              # typecheck (see caveats below)
bun run build                  # next build (standalone output)
bun run start                  # bun .next/standalone/server.js

bun run db:push                # prisma db push --accept-data-loss  ← the normal schema workflow
bun run db:generate            # prisma generate
bun run db:migrate             # prisma migrate dev (rarely used here)
bun run db:reset               # destructive

bun run scripts/ingest.ts              # run all live connectors (or pass one connector id)
bun run scripts/regen-full.ts          # baseline → products → observations → hypotheses → temporal merge
bun run scripts/regen-pipeline.ts      # pipeline regeneration
bun run scripts/gen-products.ts        # raster products only
bun run scripts/gen-obs-products.ts    # observation-scoped products
bun run scripts/raster-intelligence.ts # raster intelligence pass
bun run scripts/ri-quick.ts            # fast raster intelligence smoke run
```

`.zscripts/dev.sh` is the full orchestrated dev boot (install → `db:push` → dev server → health check
→ optional `mini-services/`). `.zscripts/build.sh` / `start.sh` are the deployment equivalents.
`Caddyfile` reverse-proxies `:81 → :3000`.

### Environment

`.env` is gitignored; `.env.example` lists the required set.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | yes | NextAuth JWT signing |
| `NEXTAUTH_URL` | yes | NextAuth callback base URL |
| `CRON_API_KEY` | no | Bearer token for `POST /api/pipeline/schedule` |
| `LOG_LEVEL` | no | `debug\|info\|warn\|error` (default `info`) |

## Testing reality — read this before claiming something works

There is **no unit/integration test suite**. `tests/` contains three bash scripts that validate the
`.zscripts/*` build scripts against fake `bun`/`python` binaries — they do not exercise app code.

Consequences:

- **`bun run lint` is the gate that must be clean** (0 errors, 0 warnings) before committing.
- `bunx tsc --noEmit` has **pre-existing errors in unrelated files**. CI runs it with
  `continue-on-error: true`, and `next.config.ts` sets `typescript.ignoreBuildErrors: true`. Type
  errors will not stop a build — so do not rely on the compiler to catch your mistake, and do not
  "fix" unrelated pre-existing errors as part of an unrelated change.
- ESLint config (`eslint.config.mjs`) disables most rules including `no-explicit-any`,
  `no-unused-vars`, and `react-hooks/exhaustive-deps`. A clean lint run is a weak signal.
- Real verification here means **exercising the route or view**: hit the API with `curl`, or drive the
  UI in a browser. The worklog history shows this is the established practice.

CI (`.github/workflows/ci.yml`) runs three jobs on push/PR to `main`: lint (blocking), typecheck
(non-blocking), and a "build check" that only asserts a few files exist.

## Layout

```
src/
  middleware.ts              API auth middleware (see Security below)
  app/
    page.tsx                 "/" — session gate, seeds auth, renders <Shell/>
    layout.tsx               fonts, ThemeProvider (dark, system disabled), both Toasters
    providers.tsx            SessionProvider
    error.tsx                app-level React error boundary
    global-error.tsx         root-level error boundary
    globals.css              theme tokens + gdt-* utilities
    login/ signup/ admin/    the only other pages
    api/**/route.ts          259 route handlers
  components/
    ui/                      48 shadcn/ui primitives (New York style) — do not hand-edit
    gdt/
      Shell.tsx              view switch + global overlays
      NavRail.tsx MobileBottomNav.tsx CommandBar.tsx StatusBar.tsx Inspector.tsx
      CommandPalette.tsx     ⌘K global search
      *Modal.tsx *Detail.tsx modal / detail dialogs
      atoms.tsx              ConfidenceBar, ConfidencePill, StatusDot, MetricStat, Sparkline, SectionLabel
      GhanaMap.tsx MiniMap.tsx SyntheticImagery.tsx LiveEngine.tsx
      views/                 34 view components, one per ViewId
  hooks/                     use-mobile, use-toast
  lib/                       116 modules — all business logic lives here
prisma/schema.prisma         224 models, single 230 KB file
scripts/                     bun-run pipeline/ingest scripts
docs/                        AUDIT_ROADMAP.md, PLATFORM_SPECIFICATION.md, KERNEL_FREEZE.md
worklog.md                   append-only task history (see Conventions)
```

Path alias: `@/*` → `./src/*` (works in `scripts/` too — bun resolves tsconfig paths).

### `src/lib` map

Domain engines. Almost every directory exports an `engine.ts` (behaviour) and some a `seed.ts`
(demo/bootstrap data).

| Area | Modules |
|---|---|
| Data in | `connectors/` (7 live + 15 metadata-only, `registry.ts`), `worldmodel/` (`connector-framework.ts`, `store.ts`, `relationships.ts`, `geometry.ts`, `event-bus.ts`, `catalog.ts`), `pipeline/pipeline.ts` |
| Earth observation | `eo/` (`grid.ts`, `spectral.ts`, `raster-products.ts`, `baseline.ts`, `store.ts`) |
| Detection & reasoning | `observation/` (`engine.ts`, `clustering.ts`, `fusion.ts`), `intelligence/` (`engine.ts`, `types.ts` — rules live here, `bundles.ts`, `decision-trace.ts`, `scenarios.ts`), `temporal/`, `continuous/` |
| Proof of work | `mission/` (`planner.ts`, `participation.ts`), `community/` (`engine.ts`, `civic-score.ts`, `rewards.ts`), `groundtruth/` (`calibration.ts`, `drift.ts`, `review-queue.ts`, `report.ts`), `calibration/loop.ts` |
| Consumer surface | `feed/`, `notifications/`, `wallet/`, `identity/`, `civic-trust/` |
| Platform / kernel | `kernel/engine.ts`, `platform/` (`specification.ts`, `negotiation.ts`), `extensions/`, `orchestration/`, `autonomous/`, `governance*/`, `federation/`, `marketplace/`, `os-marketplace/`, `aio/`, `learning/`, `knowledge/`, `multimodal/`, `reality-feed/`, `command/`, `finance/` |
| Cross-cutting | `validation/` (`schemas.ts`, `rate-limit.ts`, `audit.ts`, `cache.ts`, `gates.ts`, `observability.ts`, `evaluation.ts`), `logging/logger.ts`, `auth/` (`auth.ts`, `roles.ts`, `password.ts`), `db.ts`, `utils.ts` |
| Client-side | `gdt/` (`store.ts` Zustand, `types.ts`, `api.ts`, `geo.ts`, `geo-render.ts`, `format.ts`, `photo.ts`, `perceptual-hash.ts`, entity/observation/source/graph fixtures) |

## Conventions

### API routes

Route handlers stay thin: parse → rate-limit → validate → delegate to a `lib/*/engine.ts` →
`NextResponse.json`. Business logic does not live in `route.ts`. `src/app/api/feed/route.ts` is the
canonical example.

Mutating routes follow this exact order:

```ts
const rl = checkRateLimit(req, RATE_LIMITS.feedPost.action, RATE_LIMITS.feedPost.max, RATE_LIMITS.feedPost.windowMs);
if (!rl.allowed) return rl.response;
const body = await parseBody(req);                        // never throws — returns {} on bad JSON
const validation = validateBody(createFeedItemSchema, body);
if (!validation.success) return validation.response;       // 400 + zod issue list
const item = await createFeedItem(validation.data);
return NextResponse.json({ item });
```

Add new limits to `RATE_LIMITS` in `src/lib/validation/rate-limit.ts` and new schemas to
`src/lib/validation/schemas.ts` rather than inlining either.

**Lazy seeding**: ~33 route files call their domain seeder first, e.g.
`await seedCommunityApp().catch(() => null);`. Seeders must be idempotent and must never throw
through to the caller. Keep that pattern when adding a seeded domain.

Long-running or DB-reading routes set `export const dynamic = "force-dynamic"`; the pipeline
scheduler also sets `export const maxDuration = 300`.

Responses are named-key objects (`{ items, count }`, `{ observation }`), not bare arrays.

### Security

`src/middleware.ts` requires a NextAuth session cookie on **every** `/api/*` route, and enforces
`ADMIN`/`SUPER_ADMIN` on `/api/admin/*` and `SUPER_ADMIN` on `/api/admin/system/*`. The public
allowlist is a **regex in the matcher**:

```
"/api/((?!auth|seed-auth|stats|pipeline/schedule|health|search).*)"
```

If a new route must be publicly reachable, that regex is the only place to change — and it needs its
own auth story (`/api/pipeline/schedule` uses `CRON_API_KEY` as a bearer token).

Other security facts to keep in mind:

- Auth is NextAuth v4 **credentials** provider with bcrypt hashes and JWT sessions (30 days).
  `role`, `id`, `citizenId` are propagated through the jwt/session callbacks.
- Roles and the hierarchy live in `src/lib/auth/roles.ts` (`CITIZEN` → `SUPER_ADMIN`). Use `isAdmin`,
  `hasMinRole`, `requireRole` rather than comparing strings.
- `logAudit()` in `src/lib/auth/auth.ts` writes `AuditLog` rows and logs failures via
  `logger.error("audit.log.failed", …)` — do not reintroduce silent `catch {}` there.
- The rate limiter is **in-memory per process**: it resets on restart and does not coordinate across
  instances. Treat it as app-tier defence only.
- Photo anti-fraud lives in `src/lib/gdt/photo.ts` (EXIF, compression, browser GPS) and
  `perceptual-hash.ts` (dedup, 85% similarity threshold); GPS cross-check is a 500 m haversine.

### Client / views

- Everything under `src/components/gdt/` is `"use client"`.
- Navigation is store state, not routing. `useGDT((s) => s.view)` drives `Shell.tsx`.
- **Adding a view requires four edits**: create `views/XView.tsx`, add the id to the `ViewId` union in
  `src/lib/gdt/types.ts`, add the `{view === "x" && <XView/>}` line in `Shell.tsx`, and add the entry
  to `NavRail.tsx` / `MobileBottomNav.tsx`.
- Views fetch their own data in `useEffect` with a local `async function api(path)` helper and
  `Promise.all([...])`, each call `.catch()`-ed to a safe default so one failed endpoint cannot blank
  the view. `@tanstack/react-query` is a dependency but views do not use it — follow the local
  pattern.
- Every consumer view ships a **skeleton loading state** and a **meaningful empty state**. Both are
  expected, not optional.
- Global overlays (report modal, feed item detail, command palette) are opened by setting store flags
  so any component can trigger them; they are mounted once in `Shell.tsx`.
- `CommunityAppShell.tsx` is currently unreferenced — an alternate consumer shell kept around, not
  wired into `Shell.tsx`.

### Styling

- Tailwind CSS 4 with `@theme inline`, tokens defined in `src/app/globals.css`. shadcn/ui New York,
  `neutral` base, CSS variables, Lucide icons (`components.json`).
- Dark is the default and system theme detection is **disabled**
  (`ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}`); a light "scientific
  dashboard" palette also exists under `:root`.
- Use semantic tokens (`bg-background`, `bg-card/40`, `border-border`, `text-muted-foreground`) plus
  the intelligence semantics: `--color-intelligence` (blue), `--color-verified` (green),
  `--color-warning` (amber), `--color-critical` (red), `--color-trust` (purple), `--color-economy`
  (gold). Primary is intelligence blue `oklch(0.65 0.18 250)`.
  *(Note: `README.md` still says "no blue/indigo — teal/emerald/amber/…". That line predates the
  current theme; `globals.css` is the source of truth.)*
- Custom utilities: `.gdt-scroll` (thin scrollbar — use it on every scroll container), `.gdt-grid-bg`,
  `.gdt-grid-fine`, `.gdt-dot-bg`, `.gdt-terrain`, `.gdt-scanline`, `.gdt-ping`, `.gdt-blink`,
  `.gdt-glow-*`, `.tnum` (tabular numerals — use for all numeric columns), `.text-balance`.
- Reuse `atoms.tsx` primitives instead of re-implementing metric tiles, status dots, or sparklines.
- Base font size is 18px with a 1.65 line height; body is `overflow-hidden` and the shell is
  `h-screen` with internal scroll areas.
- Toasts: two systems coexist — shadcn `Toaster` (`use-toast`) and Sonner, positioned top-right.

### Data & schema

- Always import the singleton: `import { db } from "@/lib/db"` (globalThis-cached in dev).
- Schema changes go through `bun run db:push` (`--accept-data-loss`), not migrations. There is no
  `prisma/migrations/` directory — do not create one casually.
- `prisma/schema.prisma` is one large file with **no enums**; statuses/kinds are `String` columns
  documented by inline comments, and the corresponding unions live in TypeScript
  (`src/lib/gdt/types.ts`, `src/lib/intelligence/types.ts`, `src/lib/auth/roles.ts`). Keep both sides
  in sync.
- Geometry is stored as GeoJSON text plus indexed `centroidLng/Lat` and `minLng/minLat/maxLng/maxLat`
  bbox columns. Precise geometry ops use `@turf/turf`; projection uses `proj4`. Normalize through
  `src/lib/worldmodel/geometry.ts` (`normalizeGeometry`, `computeBBox`, `computeCentroid`).
- Rasters are `RasterGrid` — a flat `Float32Array`, row-major, row 0 = north, `NaN` nodata
  (`src/lib/eo/grid.ts`).

### Connectors

Implement `BaseConnector` (`src/lib/worldmodel/connector-framework.ts`): provide `sourceId`, `name`,
`live`, and implement `fetch()` → `IngestFeature[]` and `getVersion()`. The framework handles retries,
`ConnectorRun` rows, `DatasetSource` provenance/health, freshness, and event emission. Register it in
`src/lib/connectors/registry.ts` and add a `DATASET_CATALOG` entry in
`src/lib/worldmodel/catalog.ts` — `ensureAllSourcesRegistered()` walks the catalog, so a connector
missing from it will throw on ingest (`DatasetSource not found: <id>`).

Live connectors: `geoboundaries`, `osm-overpass`, `stac-sentinel-2`, `sentinel-1-grd`,
`chirps-rainfall`, `mining-cadastre-gha`, `dem-terrain-gha`.

### Intelligence rules

`src/lib/intelligence/types.ts` holds the `HypothesisType` union and `HYPOTHESIS_DEFS` (**9 hypothesis
types**, each with a prior) plus `RULES` (**25 rules**, each with `ruleId`, `hypothesisType`, matcher,
and likelihood ratio). `engine.ts` builds evidence bundles, applies matching rules as Bayesian updates, normalizes
posteriors across competing hypotheses, ranks, and persists with an explicit
supports/contradicts evidence trail.

Add or tune detection logic by editing `RULES` — not by special-casing inside `engine.ts`. Rules must
stay auditable: the platform's stated position is that it produces evidence and ranked hypotheses, it
does **not** conclude legality.

Evidence bundle categories: `vegetation`, `hydrology`, `infrastructure`, `terrain`, `atmospheric`.

### Kernel freeze — a hard constraint

`docs/KERNEL_FREEZE.md` declares the platform kernel frozen at v1.0.0. Within the kernel
(`src/lib/kernel/`, `src/lib/platform/`, and the 15 frozen APIs listed in that doc) only bug fixes,
security patches, performance work, docs, and compatibility fixes are permitted. **New abstractions,
models, concepts, or kernel-level APIs are not.** New functionality belongs in packages/domain
modules on top of the kernel. `docs/PLATFORM_SPECIFICATION.md` is the normative contract (including
the 20 frozen `ctx.v1.*` SDK methods).

### Logging

Use `logger` from `src/lib/logging/logger.ts` with dotted event names and a data object —
`logger.info("pipeline.run", { tilesProcessed, durationMs })`. It emits JSON in production and
pretty-prints in development, sanitizes payloads, and supports a request id. `logger.audit()` exists
for audit-shaped events. Prefer it over `console.log` in `src/lib` and API routes.

### worklog.md

Append-only project history (~2,350 lines, 75 task entries, ids running past 80). Entries use a fixed
shape and are separated by `---`:

```
Task ID: <n>
Agent: <orchestrator | full-stack-developer | ...>
Task: <one line>

Work Log:
- what was read, decided, built, and verified (including lint result)

Stage Summary:
- ✅ outcomes
```

If you complete a substantive task, append an entry in this format rather than rewriting history.
Commits in this repo typically pair a change commit with a `Update worklog: …` commit.

## Gotchas

- `README.md` project statistics and the palette line drift from the code; verify against the
  filesystem before repeating any number.
- `src/app/api/route.ts` is a leftover `{ message: "Hello, world!" }` stub.
- `next-intl` is installed but unused — the app is English-only; don't assume an i18n setup exists.
- `reactStrictMode: false` in `next.config.ts`; effects do not double-invoke in dev.
- `output: "standalone"` — `bun run start` runs `.next/standalone/server.js`, so a plain
  `next start` is not the production path.
- `dev.log` / `server.log` are gitignored tee targets of the dev/start scripts. `*.png` is gitignored
  too, so screenshots won't be committed accidentally.
- `test-seed-clear.mjs` at the repo root is a scratch script that wipes and re-seeds AIO tables —
  destructive, not a test.
- `mini-services/` is an empty extension point (`.gitkeep`); `.zscripts/dev.sh` auto-starts any
  subdirectory that has a `package.json` with a `dev` script.
- `examples/` and `skills` are excluded from ESLint.
- Demo accounts (all password `demo1234`) are created by `POST /api/seed-auth`, which `page.tsx` fires
  on mount: `kwesi.demo@`, `guardian.demo@`, `producer.demo@`, `epa.demo@`, `nadmo.demo@`,
  `developer.demo@`, `admin.demo@` (`@example.com`).

## Working agreements

- Match surrounding style: `"use client"` at the top of interactive components, named exports for
  components and engine functions, inline single-purpose helpers over new util files, comment headers
  on `lib` modules stating what the module does (and, where relevant, which audit phase it came from).
- Keep changes scoped. This codebase has many pre-existing lint/type warts; fixing unrelated ones
  inside a feature change makes review harder.
- Before saying a change works, run `bun run lint` and actually exercise the affected route or view.
- Consult `docs/AUDIT_ROADMAP.md` for the known-gaps list and phase numbering before proposing
  architectural work — most open items are already catalogued there (27/31 code items done; the
  remainder need external resources such as higher-resolution imagery).
