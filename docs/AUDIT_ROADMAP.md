# Ghana Digital Twin — Audit & Roadmap to State-of-the-Art

**Repo audited:** [github.com/pectoraux/ghana-digital-twin](https://github.com/pectoraux/ghana-digital-twin)
**Method:** Full clone + static code review (519 files, 223 Prisma models, 257 API routes) plus a deep trace of the actual satellite-analysis pipeline, Bayesian hypothesis engine, and mission/verification system.
**Date:** 2026-08-08

---

## 0. Framing

The platform's own domain model already treats illegal mining as one of nine hypothesis types it reasons about (`artisanal_mining`, `agricultural_expansion`, `deforestation`, `flood_erosion`, `quarrying`, `settlement_expansion`, …) and the community-report UI already lists `illegal_mining`, `cocoa_disease`, `flood_risk`, `deforestation`, and `water_pollution` as first-class incident types side by side. That confirms the premise: **illegal mining detection and agricultural/environmental monitoring are not separate products — they are downstream consumers of one shared capability: a spatially and temporally accurate world model that can (a) notice change, (b) reason about what caused it, and (c) get a human to confirm it with proof.** Every gap below either blocks that core capability directly, or blocks the mission/proof loop that turns a detection into a verified fact. Fix the core once, and mining, cocoa disease, flood risk, and deforestation detection all improve together — that's the "fundamental unlock" this roadmap is organized around.

---

## 1. What's already genuinely good (the foundation to build on)

| Component | Why it's solid |
|---|---|
| [`src/lib/eo/spectral.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/eo/spectral.ts) | Reads real pixel windows from real Sentinel-2 COGs (`geotiff` over HTTP) and computes correct NDVI/NDWI/NBR/EVI/BSI/MNDWI/SAVI formulas. |
| [`src/lib/eo/baseline.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/eo/baseline.ts) | Per-tile seasonal (mean/std) baselines with proper standard-error uncertainty — the right statistical approach to "is this unusual." |
| [`src/lib/intelligence/engine.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/intelligence/engine.ts) + [`bundles.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/intelligence/bundles.ts) | Genuine Bayesian multi-hypothesis reasoning with explicit likelihood ratios and an honest "no legal conclusion asserted" stance — competing explanations (mining vs. agriculture vs. road vs. flood), not a black box. |
| [`src/lib/mission/planner.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/mission/planner.ts) | Expected-Value-of-Information mission planning — ranks satellite/SAR/drone/community/inspector/IoT missions by `informationGain / cost`, already has a `community` mission type specifically for photo/video verification. |
| [`src/lib/groundtruth/calibration.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/groundtruth/calibration.ts) | Correct Brier score / ECE / precision / recall / F1 implementation against real ground-truth-to-hypothesis pairs. |
| `prisma/schema.prisma` | 223 models already anticipate the right concepts — `GroundTruth`, `CalibrationMetric`, `DriftAlert`, `SLO`, `ReviewQueue`, `Mission.evidenceCollected` — the data model doesn't need reinvention, it needs to be *fed*. |

This is the encouraging part: the architecture and the science are largely correct. The gaps are that several pieces are wired at the wrong resolution, several needed data sources were never connected, and the automated pipeline that would make it all run has no scheduler and no proof-capture front end.

---

## 2. Deep-dive: why detection isn't accurate enough yet

### 2.1 Resolution collapse — the single biggest blocker

Every anomaly product (`vegetation_anomaly`, `water_anomaly`, `bare_soil`, `change_probability`) is computed on a fixed `GRID_SIZE = 50` grid spanning the **entire Sentinel-2 scene footprint** (~110km × 110km) — [`raster-products.ts:58`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/eo/raster-products.ts#L58), [`baseline.ts:40`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/eo/baseline.ts#L40). That's **~2.2km per cell (~484 hectares)** against Sentinel-2's native 10–20m pixels — roughly a 200x resolution loss on each axis. Clustering requires ≥2 contiguous cells ([`fusion.ts:147`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/observation/fusion.ts#L147)), and the reported geometry is the cluster's bounding box ([`clustering.ts:103`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/observation/clustering.ts#L103)). **The floor for anything the pipeline can report is roughly 1,000 hectares** — a real galamsey site is 0.1–50 ha. Note the separate architecture already has the right unit for this: `ProcessingTile` is a sensible ~22km × 0.2° cell ([`continuous/grid.ts:9`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/continuous/grid.ts#L9)) — the raster-product code just never uses it, gridding the raw scene instead.

### 2.2 Missing evidence categories mean the model can't do the one thing that matters most: tell *illegal* from *legal*

`rule-mining-04` (suppress mining hypothesis if inside a licensed concession) and `rule-mining-03` (suppress if change matches seasonal flooding) exist in the ruleset, but the evidence-category map ([`bundles.ts:9`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/intelligence/bundles.ts#L9)) only ever produces `vegetation`, `hydrology`, and `terrain` categories. `infrastructure` (which would carry mining-cadastre/concession data) and `atmospheric` (rainfall) are never populated by anything — those suppression rules can **never fire**. Concretely: there is no mining-cadastre connector, and no CHIRPS/rainfall connector, anywhere in `src/lib/connectors/`. Without the cadastre check, the system cannot distinguish illegal galamsey from licensed small-scale mining — which is the actual point of "illegal mining detection."

### 2.3 It doesn't run continuously

`runContinuousPipeline` ([`continuous/pipeline.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/continuous/pipeline.ts)) is only reachable via a manual `POST /api/pipeline/run-continuous`. No cron, no worker, no scheduler exists anywhere in the repo. A digital twin that only updates when someone remembers to curl an endpoint is not monitoring anything.

### 2.4 No SAR — blind during most of the year

Ghana's rainy season (roughly April–October) means optical Sentinel-2 imagery is frequently cloud-obstructed. `sar_tasking` is defined as a mission type ("sees through clouds — critical for rainy season") and Sentinel-1 is referenced in comments and seed data, but **no Sentinel-1/SAR connector exists** in `src/lib/connectors/`. For a large fraction of the year, the optical-only pipeline is effectively blind exactly when illegal mining and flooding are most active.

### 2.5 The project's own measured accuracy is 0%

From the repo's `worklog.md` (not inference — the team's own record): *"Generated benchmark report: F1=0%, ECE=0%"* and *"ran evaluation (12 samples, 0% precision — expected since observations need regeneration on Neon)."* The calibration math is correct; it has simply never been run against a live, populated pipeline to produce a validated number.

---

## 3. Deep-dive: the mission / proof-of-work loop isn't wired up

The user-facing goal — "detect a signal, spin up a mission, get a human to confirm it with proof" — is architecturally anticipated but not implemented end to end:

- **`planMissions()` is never called automatically.** [`mission/planner.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/lib/mission/planner.ts) only runs when something explicitly invokes it with an `observationId`/`hypothesisId`; `continuous/pipeline.ts` generates hypotheses but never calls `planMissions()` afterward. So even when a hypothesis *is* created, no mission is automatically spun up to verify it.
- **There is no proof-capture pipeline.** [`CommunityReportModal.tsx`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/components/gdt/CommunityReportModal.tsx) collects a text description, a category, a severity, and a browser-geolocation coordinate — no photo or video capture. There is no S3/Cloudinary/blob-storage dependency anywhere in `package.json`, no multipart/file-upload handling in any API route. `Mission.evidenceCollected` (JSON) and the `community` mission type exist in the schema/planner, but there is no code path that actually lets a citizen attach a geotagged photo to a mission.
- **Joining a mission ≠ submitting proof.** [`/api/missions/[id]/join/route.ts`](https://github.com/pectoraux/ghana-digital-twin/blob/main/src/app/api/missions/%5Bid%5D/join/route.ts) only records participation (`role`); there's no companion "submit evidence for mission X" endpoint that writes into `Mission.evidenceCollected` or creates a `GroundTruth` record.
- **No anti-fraud on submitted proof.** Even once photo capture exists, nothing today would check that a photo was actually taken at the target location/time (EXIF/GPS cross-check against `targetLng/targetLat`, camera-capture-only vs. gallery upload, perceptual-hash dedup against reused images) — which matters a lot once verification carries reputation or reward implications (`IC earnings` already referenced in the UI).
- **The loop never closes back into calibration.** Even a confirmed mission today has no automatic path to create a `GroundTruth` row and re-run `computeCalibration()` — so the active-learning/calibration system that already exists in code has nothing real to learn from.

This is the second half of the "fundamental unlock": even a perfect detector is only as good as its ability to get a trustworthy human confirmation, and right now that loop doesn't exist end to end.

---

## 4. Roadmap

The phases below are ordered so each one either (a) is a hard prerequisite for the next, or (b) is safe to parallelize once Phase 1 lands. Phase 1 is the "fundamental unlock" — everything else, including illegal mining detection specifically, sits on top of it.

### Phase 0 — Stability & security floor (1–2 weeks)
*Prerequisite: none of the below matters if the platform leaks data or has no regression safety net while you're rebuilding the core.*
1. Lock down the API: add `src/middleware.ts` enforcing session + role checks on all `/api/*` routes (currently 256/257 routes have none — `/api/admin/users` leaks all user PII unauthenticated).
2. Wire the already-installed `zod` into request validation for every mutating route.
3. Add a CI pipeline (lint + typecheck + test on PR) and a minimal test suite, starting with the modules this roadmap is about to touch: `groundtruth/calibration.ts`, `observation/fusion.ts`, `intelligence/engine.ts`, `eo/spectral.ts`. You are about to substantially rewrite the detection core — do it with tests, not vibes.

### Phase 1 — State-of-the-art world-model core (the fundamental unlock, 6–10 weeks)
4. **Fix the resolution collapse.** Recompute raster products per `ProcessingTile` (~22km, already defined in `continuous/grid.ts`) or smaller sub-chips, reading bands at native/near-native resolution (e.g. 10-20m/pixel via `readBandWindow`-style windowed reads) instead of decimating the whole scene to a 50×50 grid. This alone moves the minimum detectable feature from ~1,000 ha to something in the 0.1–5 ha range that actually matches real disturbance sites — the single highest-leverage change in this entire roadmap, and it benefits mining, agriculture, deforestation, and flood detection simultaneously since they all consume the same grid.
5. **Migrate geometry to PostGIS.** Replace `geometryGeoJson` text + bbox-float columns with native `geometry(Geometry,4326)` + GiST indexes so spatial joins (entity-in-region, nearest-neighbor, overlap) run in the database instead of being approximated in the app layer — necessary once you're producing orders of magnitude more, finer-grained observations.
6. **Add the missing sensors.**
   - Sentinel-1 SAR connector (cloud-penetrating — closes the rainy-season blind spot; already a defined mission type with no implementation).
   - A DEM/terrain source (slope, bench-cut geometry) to actually implement the "quarrying = large-scale disturbance with bench-cut geometry, no river" rule, which currently has no terrain-shape evidence at all.
   - CHIRPS (or equivalent) rainfall connector to populate the `atmospheric` evidence category so `rule-mining-03` (seasonal-flood suppression) and `rule-flood-01` can actually fire.
   - Ghana Minerals Commission mining-cadastre/concession data (even a manually-maintained GeoJSON to start) to populate the `infrastructure` category so `rule-mining-04` (licensed-concession suppression) can actually fire. **This is the single fix that most directly makes "illegal" mining detection meaningfully different from "any" mining detection.**
7. **Turn on continuous execution.** Add a scheduler (cron-triggered job, queue worker) that actually calls `runContinuousPipeline()` on a cadence tied to Sentinel-2's 5-day revisit, with retry/backoff and failure surfaced through real observability (see Phase 5).
8. **Fix the rule-matching bug.** `matchRule()`'s substring matching means `rule-mining-03`'s `"seasonal water expansion"` condition never matches the actual indication strings produced by `deriveIndication()` (`"water expansion"` / `"water loss"`) — audit every rule's `conditions` against what `deriveIndication()` and the (new) evidence categories actually emit, so the suppression rules that exist on paper actually execute.

### Phase 2 — Illegal-mining detection hardening (parallel with late Phase 1, 4–6 weeks)
9. **Validate against real ground truth.** Partner with a small number of known sites (confirmed legal concessions + confirmed illegal galamsey sites, e.g. via EPA Ghana or Minerals Commission contacts) to seed real `GroundTruth` records, then re-run `computeCalibration()` until precision/recall are real, non-zero, and reported — not the 0%/0% currently in the worklog. Treat the existing SLO targets (`detection precision >70%, recall >60%` in `validation/gates.ts`) as the acceptance bar before calling this "production."
10. **Add the excavation-geometry and turbidity signals** the mission planner already asks for but the pipeline doesn't yet produce: pit/bench-cut shape detection (from the new DEM source) and river-turbidity trend (an `iot` mission type already exists for this — wire a real sensor feed or start with Sentinel-2-derived turbidity proxy downstream of flagged sites).
11. **Re-run the scientific evaluation** (`src/lib/validation/evaluation.ts`, the 12-sample benchmark harness) after Phase 1 lands, expand the benchmark set well beyond 12 samples, and report per-biome/per-class precision/recall as the project already scaffolds.

### Phase 3 — Mission + proof-of-work loop (parallel with Phase 2, 4–6 weeks)
12. **Auto-trigger missions from detections.** Call `planMissions()` automatically at the end of `runContinuousPipeline()` for every newly created hypothesis below the confidence threshold — closing the gap between "detected" and "a mission exists to verify it."
13. **Build real proof capture.** Add camera-capture (not gallery-upload) photo/video to the community-report and mission-join flows, with geotag + timestamp attached client-side, uploaded to object storage (S3/R2/Cloudinary — pick one, none currently exist in the stack).
14. **Add proof integrity checks.** Cross-check submitted photo GPS/EXIF against the mission's `targetLng/targetLat/targetRadiusM`; reject or down-weight submissions outside the radius or with stripped/implausible metadata; perceptual-hash submitted images to catch reused/stock photos.
15. **Close the loop into calibration.** When enough independent submissions agree (or a reviewer confirms via the existing `ReviewQueue`), auto-create a `GroundTruth` record and re-trigger `computeCalibration()` — turning every confirmed mission into a training signal, which is the entire point of the `LearnedPrior`/`LearningUpdate` models already in the schema.
16. **Tie proof quality to reputation honestly.** The app already has trust tiers and IC-earnings UI (`Sparkline`, tier badges) — extend `verifierCredibility` on `GroundTruth` to actually reflect a contributor's track record of confirmed-vs-rejected submissions, so bad-faith or careless reports get down-weighted over time rather than treated as equally trustworthy.

### Phase 4 — Multi-domain payoff (once Phase 1–3 land, ongoing)
This is where the "fundamental unlock" framing pays off — none of this requires new core infrastructure, just new hypothesis types and mission triggers on top of what Phase 1–3 built:
17. **Cocoa/CSSVD monitoring**: the UI already lists `cocoa_disease` as an incident type with no backing detection logic. NDVI/EVI anomaly at native resolution (Phase 1) over cocoa-growing regions, cross-referenced with community photo reports (Phase 3), is a direct reuse of the mining pipeline.
18. **Flood risk**: `flood_erosion` is already a modeled hypothesis type; it just needs the rainfall connector (Phase 1, item 6) and DEM-based low-lying-area context to become reliable, ahead of it being useful for early warning rather than after-the-fact detection.
19. **Deforestation / forest-reserve encroachment**: already modeled (`deforestation` hypothesis, `burn_severity` product); add a forest-reserve-boundary connector (Ghana Forestry Commission boundaries, similar shape to the mining-cadastre work in Phase 1) so "vegetation loss in a protected reserve" becomes a distinguishable, higher-confidence signal.
20. **General land-use change**: `settlement_expansion`, `road_construction`, `infrastructure_development` hypotheses already exist and only need the `infrastructure` evidence category (Phase 1, item 6) to start producing real signal instead of never firing.

### Phase 5 — Platform hardening (cross-cutting, ongoing alongside all of the above)
21. Structured logging + error tracking (Sentry/OpenTelemetry) — you cannot debug a national-scale continuous pipeline with `console.log` + `tee`.
22. Real liveness/readiness health checks (DB + all external connectors) separate from the existing data-completeness dashboards.
23. Secrets management, backup/DR runbook, and a compliance pass against Ghana's Data Protection Act (Act 843) before any deployment involving real citizen PII or government data-sharing.
24. Rate limiting and audit-log reliability (currently `logAudit()` silently swallows failures) — increasingly important once missions carry reputation/reward stakes that create an incentive to game the system.

---

## 5. Priority summary

| Fix | Unlocks | Effort |
|---|---|---|
| Native-resolution per-tile gridding (Phase 1.4) | Everything — mining, agriculture, flood, deforestation all consume this grid | High, highest leverage |
| Mining cadastre + rainfall connectors (Phase 1.6) | The actual "illegal vs. legal / natural vs. anthropogenic" distinction | Medium |
| Continuous scheduler (Phase 1.7) | A twin that's actually current, not dormant | Low |
| SAR connector (Phase 1.6) | Rainy-season coverage (~6 months/year currently blind) | Medium-High |
| Auto mission triggering (Phase 3.12) | Detections actually turning into verification requests | Low |
| Proof capture + integrity (Phase 3.13-14) | Trustworthy human confirmation — the other half of "detect + confirm" | Medium |
| API auth (Phase 0.1) | Not shipping a PII leak | Low, blocking |

## 6. Bottom line

The fastest path to "state of the art" here is not new features — it's fixing the resolution at which the existing, well-designed pipeline operates, connecting the two data sources (cadastre, rainfall) the model's own rules already assume exist, scheduling the pipeline so it actually runs, and building the proof-capture step that turns a statistical anomaly into a confirmed fact. Because the domain model was built generically from day one (nine hypothesis types, not just "mining"), every one of those fixes pays off across illegal mining, cocoa disease, flood risk, and deforestation at once — which is exactly the leverage the project's own architecture was designed for.
