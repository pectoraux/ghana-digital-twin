# Ghana Digital Twin (GDT)

A continuously updating, AI-native geospatial world model of the Republic of Ghana. Built on Next.js 16 with a 224-model Prisma schema, 259 API routes, 7 live data connectors, and a 25-rule Bayesian intelligence engine that detects illegal mining, deforestation, flood risk, cocoa disease, and land-use change from satellite imagery.

## Architecture

```
Satellite/SAR/Rainfall/Cadastre → Connectors → Raster Products (200×200/tile)
    → Observation Engine → Bayesian Hypothesis Engine (25 rules, 9 types)
    → Mission Planner (EVI-ranked) → Community Verification (photo + witness)
    → Calibration Loop (auto-confirm → GroundTruth → computeCalibration)
```

### Core Pipeline
1. **Connectors** fetch data from STAC APIs, OSM, geoBoundaries, and custom sources
2. **Raster Products** compute spectral indices (NDVI, NDWI, BSI, NBR) at ~110m/cell resolution per tile
3. **Observation Engine** detects anomalies vs seasonal baselines
4. **Intelligence Engine** generates Bayesian hypotheses with 25 rules across 9 types
5. **Mission Planner** auto-creates verification missions (EVI-ranked)
6. **Community Loop** — citizens report incidents, attach geotagged photos, witnesses confirm/reject
7. **Calibration Loop** — confirmed events auto-create GroundTruth records and trigger calibration

### Evidence Categories
All 5 evidence categories are populated by connectors:
- **Vegetation** — NDVI/BSI anomalies (Sentinel-2)
- **Hydrology** — NDWI water body changes (Sentinel-2)
- **Infrastructure** — mining cadastre + OSM features (licensed concessions, roads, settlements)
- **Terrain** — DEM elevation/slope/bench-cut geometry
- **Atmospheric** — CHIRPS seasonal rainfall

## Consumer Experience

7 primary views accessible from the nav rail (desktop) or bottom tab bar (mobile):
- **Home** — greeting, reputation cards with sparklines + tier labels, activity map, intelligence pulse, missions, quick actions
- **Intelligence Feed** — filterable feed with colored left borders, inline quick-actions (Like, Comment, Verify, Join), clickable cards opening detail dialog
- **Map** — interactive SVG map of Ghana with layered geography
- **Missions** — mission cards with progress bars, participant counts, Join button, detail dialog with stats + participants
- **Community** — active reports with witness Confirm/Reject, leaderboard with rank icons + trust badges, report incident modal with camera capture + GPS + severity
- **Rewards** — wallet balance, transaction history, withdrawal to mobile money (MTN/Vodafone/AirtelTigo), reputation progress bars
- **Profile** — identity card with edit, reputation grid, impact stats, achievements/badges (14 across 4 tiers), activity timeline

### Key Features
- **⌘K Command Palette** with global search across feed, events, citizens, missions
- **Notification Center** with 8 notification types, polling, click-to-navigate
- **Report Modal** for intelligence feed posts (4 types, region/category selects, confidence estimation)
- **Community Report Modal** for incident reports (7 types, 4 severity levels, GPS, camera photo capture with EXIF + compression + perceptual-hash dedup)
- **Feed Item Detail** with comments, like, share, verify, flag actions
- **Mission Detail** with stats grid, participants list, join flow
- **Wallet** with IC balance, transactions, mobile money withdrawal
- **Profile Edit** with display name, bio, region, interests, skills
- **Achievements** with 14 badges across bronze/silver/gold/platinum tiers

## Technical Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: PostgreSQL (Neon) with Prisma ORM (224 models)
- **Auth**: NextAuth.js v4 with role-based access (CITIZEN → ADMIN)
- **State**: Zustand (client) + React Query patterns (server)
- **Icons**: Lucide React
- **Validation**: Zod (8 schemas on 7 mutating routes)
- **Security**: API auth middleware, rate limiting, audit logging

## Security & Platform Hardening

- **API Auth Middleware** — session enforcement on all `/api/*` routes, admin role checks
- **Zod Validation** — 8 schemas wired into 7 mutating API routes
- **Rate Limiting** — 9 pre-configured limits (feed-post 10/min, withdraw 3/min, etc.)
- **Photo Anti-Fraud** — GPS cross-check (500m haversine), EXIF extraction, perceptual-hash dedup (85% similarity threshold)
- **Verifier Credibility** — trust-level based (expert=0.95 → new=0.60), adjusted by track record (+0.1 for >80% accuracy, ×0.5 for >30% false-reports)
- **Audit Logging** — structured logging with failure visibility (no more silent swallowing)
- **Health Checks** — `/api/health` with DB + connectors + pipeline status
- **CI Pipeline** — GitHub Actions (lint + typecheck + build on every PR/push)

## Intelligence Engine

25 rules across 9 hypothesis types with boost/suppress logic:

| Hypothesis | Rules | Key Suppressions |
|---|---|---|
| Artisanal mining | 6 | Licensed concession, seasonal flood, no bare soil, forest reserve |
| Agricultural expansion | 3 | Cocoa disease (CSSVD) detection |
| Flood erosion | 4 | High rainfall → suppress mining |
| Deforestation | 4 | Forest reserve boundary → strong boost |
| Settlement expansion | 2 | Infrastructure proximity |
| Road construction | 1 | Linear disturbance + road proximity |
| Infrastructure development | 1 | Large-scale + structured geometry |
| Quarrying | 1 | Bench-cut terrain geometry |
| Natural clearing | 1 | Seasonal baseline match |

## Connectors

7 live data connectors:

| Connector | Source | Evidence Category |
|---|---|---|
| `stac-sentinel-2` | Element 84 Earth Search STAC | Vegetation, Hydrology (optical) |
| `sentinel-1-grd` | Sentinel-1 SAR (cloud-penetrating) | Rainy-season coverage |
| `chirps-rainfall` | Seasonal rainfall per region | Atmospheric |
| `mining-cadastre-gha` | 14 known licensed concessions | Infrastructure |
| `dem-terrain-gha` | Elevation, slope, bench-cut geometry | Terrain |
| `geoboundaries` | Administrative boundaries | Infrastructure |
| `osm-overpass` | OpenStreetMap features | Infrastructure |

## Development

```bash
bun install
bun run dev          # Start dev server on port 3000
bun run lint         # ESLint
bun run db:push      # Push Prisma schema to database
bun run db:generate  # Generate Prisma client
```

### Environment Variables
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### Demo Accounts
- Citizen: `kwesi.demo@example.com` / `demo1234`
- Guardian: `guardian.demo@example.com` / `demo1234`
- Producer: `producer.demo@example.com` / `demo1234`
- EPA Org: `epa.demo@example.com` / `demo1234`
- NADMO Gov: `nadmo.demo@example.com` / `demo1234`
- Developer: `developer.demo@example.com` / `demo1234`
- Admin: `admin.demo@example.com` / `demo1234`

## Project Statistics

- 34 views, 9 dialogs/modals
- 259 API routes
- 224 Prisma models
- 7 live connectors
- 25 intelligence rules
- 116 lib modules
- Mobile-responsive (bottom tab bar on mobile, side rail on desktop)
- Dark geospatial intelligence theme (no blue/indigo — teal/emerald/amber/rose/cyan/violet/orange)

## Documentation

- `docs/AUDIT_ROADMAP.md` — Production-readiness audit + implementation progress
- `docs/PLATFORM_SPECIFICATION.md` — Platform specification
- `docs/KERNEL_FREEZE.md` — Kernel freeze policy
- `worklog.md` — Full work history (2000+ lines)

## License

Private project.
