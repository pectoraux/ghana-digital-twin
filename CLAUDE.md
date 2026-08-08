# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Ghana Digital Twin (GDT)** — a continuously updating, AI-native geospatial world model of the
Republic of Ghana. A single Next.js 16 application that ingests satellite/SAR/rainfall/cadastre
data, detects anomalies against seasonal baselines, generates ranked Bayesian hypotheses
(illegal mining, deforestation, flood erosion, cocoa disease, land-use change), spins up
verification missions, collects geotagged citizen proof, and feeds confirmations back into a
calibration loop.

Scale: ~259 API routes, 224 Prisma models, 116 lib modules, 34 views, 7 live connectors,
25 intelligence rules. Treat it as a large, layered codebase — read the neighborhood before editing.

The system **never asserts legal conclusions**. It produces ranked, evidence-backed hypotheses with
explicit supporting *and* contradicting evidence. Preserve that framing in any copy, API response,
or model output you write.

## Commands

Package manager is **bun** (`bun.lock` is committed; do not introduce npm/yarn/pnpm lockfiles).

```bash
bun install            # installs + runs `prisma generate` via postinstall
bun run dev            # Next dev on :3000, tees to dev.log
bun run lint           # ESLint — must be 0 errors, 0 warnings before commit
bunx tsc --noEmit      # type check (CI runs this with continue-on-error)
bun run build          # next build (standalone output)
bun run start          # runs .next/standalone/server.js

bun run db:push        # prisma db push --accept-data-loss  ← the normal schema workflow
bun run db:generate    # prisma generate
bun run db:migrate     # prisma migrate dev (rarely used here)
bun run db:reset       # destructive

bun run scripts/ingest.ts             # run all live connectors
bun run scripts/ingest.ts <sourceId>  # run one connector
bun run scripts/gen-products.ts       # raster products
bun run scripts/regen-pipeline.ts     # full pipeline regeneration
```

`.zscripts/dev.sh` is the full bootstrap (install → `db:push` → dev server → health check →
mini-services). Use it when you need a cold start; `bun run dev` is enough for iteration.

**Verification loop before any commit:** `bun run lint` (zero errors/warnings) and, when the change
touches types, `bunx tsc --noEmit`. There is no unit-test runner in this repo — the `tests/`
directory contains shell tests for the `.zscripts` build scripts only, not application tests.
So lint + typecheck + actually exercising the affected route/view is the real safety net.

## Environment

```
DATABASE_URL=postgresql://...   # Neon PostgreSQL
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
CRON_API_KEY=...                # optional; guards POST /api/pipeline/schedule
```

`.env*` is gitignored. `.env.example` is the template.

Demo accounts (seeded by `POST /api/seed-auth`, called from the root page on mount) — password
`demo1234` for all: `kwesi.demo@`, `guardian.demo@`, `producer.demo@`, `epa.demo@`, `nadmo.demo@`,
`developer.demo@`, `admin.demo@` (all `@example.com`).

## Architecture

### Request/render model

There is effectively **one page**. `src/app/page.tsx` gates on a NextAuth session (redirect to
`/login` if absent) and renders `<Shell />`. `Shell.tsx` is a client component that switches on
`useGDT((s) => s.view)` — a Zustand string enum — and renders one of 34 view components inside a
framer-motion `AnimatePresence`. **View routing is Zustand state, not the Next router.** URL never
changes. Other real routes: `/login`, `/signup`, `/admin`.

Views are `"use client"` and fetch from `/api/*` with plain `fetch` in `useEffect`. TanStack Query
is a dependency but is *not* the prevailing pattern — follow the local `useState` + `useCallback`
loader pattern in sibling views rather than introducing Query into an existing view.

```
src/
├── app/
│   ├── page.tsx            single SPA entry → Shell
│   ├── layout.tsx          ThemeProvider(dark, enableSystem=false) + SessionProvider + Toasters
│   ├── error.tsx           app-level React error boundary
│   ├── global-error.tsx    root boundary (inline styles, no Tailwind dependency)
│   ├── globals.css         design tokens + .gdt-* utilities
│   ├── login/ signup/ admin/
│   └── api/                259 route.ts files
├── components/
│   ├── gdt/                Shell, CommandBar, NavRail, MobileBottomNav, Inspector,
│   │   │                   StatusBar, CommandPalette, NotificationCenter, modals, atoms.tsx
│   │   └── views/          34 view components
│   └── ui/                 shadcn/ui (New York) — regenerate, don't hand-edit
├── hooks/                  use-mobile, use-toast
├── lib/                    116 modules, 41 domains (see below)
└── middleware.ts           API auth + role enforcement
```

### The core pipeline

```
Connectors → Raster Products → Observation Engine → Intelligence Engine
   → Mission Planner → Community Verification → Calibration Loop → (priors)
```

| Stage | Module | Notes |
|---|---|---|
| Connectors | `lib/connectors/*`, `lib/worldmodel/connector-framework.ts` | 7 live + metadata-only registrations |
| Spectral / raster | `lib/eo/spectral.ts`, `raster-products.ts`, `baseline.ts`, `grid.ts` | NDVI/NDWI/NBR/EVI/BSI/MNDWI/SAVI from real Sentinel-2 COGs via `geotiff` |
| Observation | `lib/observation/{engine,fusion,clustering}.ts` | anomaly vs seasonal baseline, then clustering |
| Intelligence | `lib/intelligence/{engine,bundles,types}.ts` | 25 rules × 9 hypothesis types, Bayesian posteriors with likelihood ratios |
| Missions | `lib/mission/planner.ts` | EVI-ranked (`informationGain / cost`) |
| Community | `lib/community/*`, `lib/feed/*` | citizen events, witnesses, civic score, rewards |
| Ground truth | `lib/groundtruth/{calibration,drift,review-queue,report}.ts` | Brier / ECE / precision / recall / F1 |
| Continuous | `lib/continuous/{grid,pipeline}.ts` | `runContinuousPipeline()`, driven by `POST /api/pipeline/schedule` on a 5-day Sentinel-2 cadence |

Evidence categories are `vegetation | hydrology | infrastructure | terrain | atmospheric`. A rule
can only fire if some connector actually populates its category — when adding suppression rules,
verify the category is fed, and verify the rule's `conditions` strings match what
`deriveIndication()` actually emits (substring matching has silently broken rules here before).

### Other lib domains

`aio` (autonomous orgs), `autonomous`, `civic-trust` (trust graph, Sybil), `command` (command
center), `extensions`, `federation`, `finance`, `governance` / `governance-v2` /
`governance-intel`, `identity`, `kernel`, `knowledge`, `learning`, `marketplace`,
`multimodal`, `notifications`, `orchestration`, `os-marketplace`, `platform`, `reality-feed`,
`temporal`, `wallet`, `worldmodel`.

`lib/gdt/` is the **client-side** layer: `store.ts` (Zustand), `types.ts` (`ViewId`, entity kinds),
`format.ts`, `geo.ts` / `geo-render.ts` (projection — note `formatCoord` lives in `geo.ts`, not
`format.ts`), `photo.ts`, `perceptual-hash.ts`, plus static demo datasets
(`entities.ts`, `observations.ts`, `sources.ts`, `graph.ts`).

## Kernel freeze — read before adding abstractions

`docs/KERNEL_FREEZE.md` declares the platform kernel **frozen at v1.0.0**. 15 APIs are frozen
(PackageManifest, CapabilityContract, Artifact, EventBus, SDK `ctx.v1.*`, PolicyEngine,
ExecutionPlan, …). Within v1.x only **bug fixes, security patches, performance, docs, and
compatibility fixes** are permitted to the kernel. New abstractions, models, concepts, and
kernel-level APIs are **not**.

New functionality goes in as a **package** on top of the kernel. Experimental surface is namespaced
`ctx.experimental.*`. `docs/PLATFORM_SPECIFICATION.md` is the normative contract. If a task seems
to require a new kernel concept, say so and propose a package-shaped alternative rather than
quietly extending the kernel.

## Conventions

### API routes

Every route is `src/app/api/<path>/route.ts` exporting `GET`/`POST`/etc. taking `NextRequest`.

```ts
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.feedPost.action, RATE_LIMITS.feedPost.max, RATE_LIMITS.feedPost.windowMs);
  if (!rl.allowed) return rl.response;

  const body = await parseBody(req);
  const validation = validateBody(createFeedItemSchema, body);
  if (!validation.success) return validation.response;

  const item = await createFeedItem(validation.data);
  return NextResponse.json({ item });
}
```

Rules:

- **Auth is middleware-level, not per-route.** `src/middleware.ts` wraps everything in
  `withAuth`. Its matcher exempts only `auth`, `seed-auth`, `stats`, `pipeline/schedule`, `health`,
  `search`. `/api/admin/*` requires `ADMIN`/`SUPER_ADMIN`; `/api/admin/system/*` requires
  `SUPER_ADMIN`. **Adding a public route means editing the matcher regex** — and that is a security
  decision, so justify it.
- **Every mutating route validates with Zod.** Schemas live in `lib/validation/schemas.ts`; use
  `parseBody` + `validateBody`. Add new schemas there, not inline.
- **Rate-limit mutating/expensive routes** with the presets in `lib/validation/rate-limit.ts`
  (`RATE_LIMITS`). The limiter is in-memory and resets on restart — acceptable at the app tier.
- Business logic lives in `lib/<domain>/`; routes stay thin (parse → validate → call engine → JSON).
- Long-running routes set `export const dynamic = "force-dynamic"` and `export const maxDuration`.
- **Seed-on-read**: some routes call an idempotent seeder (`await seedCommunityApp().catch(() => null)`)
  before serving. Match the surrounding file's behavior; don't add new seed-on-read paths casually.
- Responses are bare JSON objects (`{ items, count }`, `{ item }`, `{ error }`) — no envelope wrapper.

### Prisma / database

- `prisma/schema.prisma` — 5,940 lines, 224 models, **zero enums**. Status/kind/type fields are
  `String` with the allowed values documented in a trailing comment. Follow that.
- **JSON is stored as `String`** with `@default("{}")` / `@default("[]")` and stringified at the
  call site. Not `Json` columns.
- **Geometry is GeoJSON text** (`geometryGeoJson`) plus denormalized float columns
  (`centroidLng/Lat`, `minLng/minLat/maxLng/maxLat`) used as the spatial index. PostGIS is *not*
  in use; precise geometry ops go through `@turf/turf` in the app layer.
- Import the singleton: `import { db } from "@/lib/db"` — never construct a `PrismaClient`
  in application code (standalone `.mjs` maintenance scripts are the exception).
- Schema changes: edit `schema.prisma` → `bun run db:push` → `bun run db:generate`. Migrations are
  not the working convention here.
- Models carry provenance (`datasetSourceId`, `sourceName`, `confidence`) and are often versioned
  (`EntityVersion`, `ObservationVersion`, `ReplayVersion`). Preserve provenance when writing rows.
- Audit writes go through the `AuditLog` model. Failures are **logged, never swallowed** —
  see `logAudit` in `lib/auth/auth.ts` and `lib/logging/logger.ts`.

### Auth

NextAuth v4, credentials provider, JWT sessions (30d), bcrypt via `lib/auth/password.ts`. Roles
escalate `CITIZEN → … → ADMIN → SUPER_ADMIN` (`lib/auth/roles.ts`). `session.user` carries
`id`, `role`, `citizenId` (cast through `as any` — that's the established pattern here).

### UI and design system

- **Tailwind CSS 4** with CSS-variable tokens in `src/app/globals.css`. Light tokens on `:root`,
  dark on `.dark`. Default theme is **dark**, `enableSystem={false}`.
- Semantic tokens only for structure: `bg-background`, `bg-card`, `border-border`,
  `text-muted-foreground`, `text-foreground`. Plus GDT semantics: `--color-intelligence` (blue),
  `--color-verified` (green), `--color-warning` (amber), `--color-critical` (red),
  `--color-trust` (purple), `--color-economy` (gold).
- Per-category accents are inline hex constants in a `*_META` record at the top of the view
  (see `FEED_TYPE_META` in `FeedView.tsx`). Follow that shape for new categorical color maps.
  Note: older docs/worklog entries say "no blue/indigo" — that rule is historical. The current
  palette is built around `--primary` = *intelligence blue*.
- Custom utilities in `globals.css`: `.gdt-scroll` (styled scrollbars — use on every scroll
  container), `.gdt-grid-bg`, `.gdt-grid-fine`, `.gdt-dot-bg`, `.gdt-terrain`, `.gdt-scanline`,
  `.gdt-ping`, `.gdt-blink`, `.gdt-glow-{emerald,gold,rose}`, `.tnum` (tabular numerals — use on
  all numeric readouts), `.shadow-card`.
- Shared primitives in `components/gdt/atoms.tsx`: `ConfidenceBar`, `ConfidencePill`, `StatusDot`,
  `MetricStat`, `Sparkline`, `SectionLabel`. Reuse before writing new ones.
- shadcn/ui components live in `components/ui/` (New York style, neutral base, lucide icons,
  CSS variables). Add via the shadcn CLI; don't hand-roll equivalents.
- Icons: `lucide-react` only.
- **Loading states are shaped skeletons, not spinners.** `bg-foreground/15` for primary elements,
  `bg-foreground/10` for secondary, with `animate-pulse`, laid out to mimic the final layout.
  Plain `Loader2` spinners were deliberately removed from consumer views — don't reintroduce them.
- Empty states get a muted icon + heading + one-line explanation (see `MiniMap`), never a blank box.
- Responsive: `NavRail` (desktop side rail) and `MobileBottomNav` (mobile tab bar) are separate
  components. Both must be updated when primary navigation changes.
- Toasts: Sonner, positioned `top-right` (moved off bottom-right because it overlapped content).

### TypeScript

`strict: true` but `noImplicitAny: false`; `next.config.ts` sets `typescript.ignoreBuildErrors:
true`, so **the build will not catch type errors — run `bunx tsc --noEmit` yourself.** ESLint is
deliberately permissive (`no-explicit-any`, `no-unused-vars`, `exhaustive-deps` all off), so lint
passing is a low bar, not a quality signal. Path alias is `@/*` → `./src/*`.

## Common task recipes

**Add a view**
1. Add the id to the `ViewId` union in `src/lib/gdt/types.ts`.
2. Create `src/components/gdt/views/<Name>View.tsx` — `"use client"`, single named export,
   `h-full w-full` with internal `.gdt-scroll` regions.
3. Import it in `Shell.tsx` and add the `{view === "<id>" && <NameView />}` line.
4. Register it in `NavRail.tsx` (`PRIMARY_NAV` for consumer-facing, `ADVANCED_NAV` otherwise) and,
   if primary, in `MobileBottomNav.tsx`.
5. Give it a skeleton loading state and an empty state.

**Add an API route** — create `src/app/api/<path>/route.ts`, put the logic in `lib/<domain>/`, add a
Zod schema to `lib/validation/schemas.ts` for any mutation, wire a `RATE_LIMITS` entry, and confirm
the middleware matcher gives it the auth posture you intend.

**Add a connector** — subclass `BaseConnector` in `src/lib/connectors/<name>.ts` (implement `fetch`
and `getVersion`), register it in `lib/connectors/registry.ts`, add its dataset to
`lib/worldmodel/catalog.ts`, and state which **evidence category** it populates. Test with
`bun run scripts/ingest.ts <sourceId>`.

**Add an intelligence rule** — extend `RULES` in `lib/intelligence/types.ts`. Verify the rule's
`conditions` actually match emitted indication strings and that its evidence category is populated
by a live connector, otherwise the rule is dead on arrival.

## Worklog — required

`worklog.md` (~350KB, task-numbered, append-only) is the project's authoritative history. **Every
substantive change appends an entry** in this format:

```
---
Task ID: <n>
Agent: <role>
Task: <one line>

Work Log:
- <what was read/decided/changed, file by file>
- Lint: 0 errors, 0 warnings.

Stage Summary:
- ✅ <outcome>
```

Read the tail of `worklog.md` before starting — it carries the most recent decisions and known
issues, and is frequently more current than `README.md`.

## Docs

- `docs/AUDIT_ROADMAP.md` — production-readiness audit with phase-numbered roadmap. Code comments
  reference these phases (`// Phase 5.24`, `// Phase 1.6`); keep that convention when implementing
  roadmap items.
- `docs/PLATFORM_SPECIFICATION.md` — normative kernel spec v1.0.
- `docs/KERNEL_FREEZE.md` — freeze policy.
- `README.md` — user-facing overview (some details lag the code; worklog wins).

## Git & CI

- CI (`.github/workflows/ci.yml`): lint (blocking) → typecheck (`continue-on-error: true`) →
  structure check. Bun with `--frozen-lockfile`, so commit `bun.lock` alongside `package.json`.
- Commit messages are short and imperative, often phase- or task-tagged
  (`Phase 5.23a (audit-log reliability) + Phase 4.20 (land-use change rules)`,
  `UX polish: add skeleton loading to Feed + Missions views`).
- Worklog updates are usually their own commit (`Update worklog: <topic> (Task N)`).
- Don't commit `dev.log`, `server.log`, `*.png`, or anything under `/skills/`, `/db/`, `/agent-ctx/`.

## Known gotchas

- `next.config.ts` has `reactStrictMode: false` and `ignoreBuildErrors: true` — a green build
  proves very little.
- The dev script caps heap at 1024MB (`NODE_OPTIONS=--max-old-space-size=1024`); the 5,940-line
  schema and 259 routes make dev compilation memory-hungry.
- The rate limiter is per-process and in-memory — it does not hold across restarts or instances.
- `formatCoord` is exported from `lib/gdt/geo.ts`, not `lib/gdt/format.ts` (a recurring import bug).
- Static demo data in `lib/gdt/*.ts` coexists with live DB data. Know which one a view is reading
  before "fixing" numbers that look wrong.
- Test data created while exercising the app persists in the shared Neon database and shows up in
  the feed. Clean up after yourself.
