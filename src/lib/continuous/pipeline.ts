// Ghana Digital Twin — Continuous Processing Pipeline
// Automatically processes new satellite imagery across all Ghana tiles.
// For each tile: find newest scene → compute products → generate observations
// → update hypotheses → update phenomena. The system runs itself.

import { db } from "@/lib/db";
import { initializeGrid, getTilesNeedingProcessing, markTileProcessed, markStaleTiles } from "./grid";
import { computeProduct } from "@/lib/eo/raster-products";
import { runObservationScan } from "@/lib/observation/engine";
import { runTemporalMerge } from "@/lib/temporal/engine";
import { generateHypotheses } from "@/lib/intelligence/engine";
import { planMissions } from "@/lib/mission/planner";
import { emit } from "@/lib/worldmodel/event-bus";
import { logger } from "@/lib/logging/logger";

export interface PipelineResult {
  runId: string;
  tilesProcessed: number;
  tilesTotal: number;
  scenesProcessed: number;
  observationsCreated: number;
  observationsUpdated: number;
  hypothesesCreated: number;
  phenomenaCreated: number;
  missionsPlanned: number;
  durationMs: number;
  status: string;
  errors: string[];
}

/**
 * Run the continuous processing pipeline across Ghana.
 * Processes tiles that need it (new imagery or stale).
 */
export async function runContinuousPipeline(opts: { tileLimit?: number; regionId?: string } = {}): Promise<PipelineResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  const pipeLogger = logger.child({ runId: startedAt.getTime().toString(36) });

  pipeLogger.info("pipeline.start", { tileLimit: opts.tileLimit ?? 20, regionId: opts.regionId ?? "all" });

  // 1. ensure grid exists
  await initializeGrid();

  // 2. mark stale tiles
  await markStaleTiles();

  // 3. create a processing run record
  const run = await db.processingRun.create({
    data: {
      startedAt,
      status: "running",
    },
  });

  // 4. get tiles needing processing
  const tiles = await getTilesNeedingProcessing({ limit: opts.tileLimit ?? 20, regionId: opts.regionId });

  let tilesProcessed = 0;
  let scenesProcessed = 0;
  let observationsCreated = 0;
  let observationsUpdated = 0;
  let hypothesesCreated = 0;
  let phenomenaCreated = 0;
  let missionsPlanned = 0;

  for (const tile of tiles) {
    try {
      // find the newest scene covering this tile
      const scene = await db.rasterScene.findFirst({
        where: {
          minLng: { lte: tile.maxLng },
          maxLng: { gte: tile.minLng },
          minLat: { lte: tile.maxLat },
          maxLat: { gte: tile.minLat },
          cloudCover: { lte: 40 },
        },
        orderBy: { datetime: "desc" },
      });

      if (!scene) {
        // no scene available — mark as processed (nothing to do)
        await markTileProcessed(tile.tileId, null, 0);
        tilesProcessed++;
        continue;
      }

      // check if this scene is newer than what we last processed
      if (tile.lastSceneId === scene.id) {
        // already processed this scene — skip
        await markTileProcessed(tile.tileId, scene.id, 0);
        tilesProcessed++;
        continue;
      }

      scenesProcessed++;

      // compute raster products for this scene (if not already computed)
      const existingProducts = await db.rasterProduct.findMany({
        where: { sceneId: scene.id, mgrsTile: scene.mgrsTile },
        select: { type: true },
      });
      const existingTypes = new Set(existingProducts.map((p) => p.type));

      const productTypes = ["vegetation_anomaly", "bare_soil", "change_probability"] as const;
      for (const pt of productTypes) {
        if (existingTypes.has(pt)) continue;
        try {
          // check if baseline exists
          if (pt === "vegetation_anomaly" || pt === "change_probability") {
            const baseline = await db.seasonalBaseline.findFirst({
              where: { mgrsTile: scene.mgrsTile, indexName: "NDVI" },
            });
            if (!baseline) continue; // skip if no baseline
          }
          // Phase 1.4: Pass tile extent for high-resolution per-tile processing
          const tileExtent = {
            minLng: tile.minLng,
            minLat: tile.minLat,
            maxLng: tile.maxLng,
            maxLat: tile.maxLat,
          };
          await computeProduct({ type: pt, sceneId: scene.id, mgrsTile: scene.mgrsTile, tileExtent });
        } catch (e) {
          errors.push(`Product ${pt} for ${scene.stacId}: ${String(e).slice(0, 100)}`);
        }
      }

      // generate observations for this tile
      let tileObsCreated = 0;
      let tileHypCreated = 0;
      let tileMissionsPlanned = 0;
      try {
        const obsResult = await runObservationScan({ mgrsTile: scene.mgrsTile });
        tileObsCreated = obsResult.observationsCreated;
        observationsCreated += obsResult.observationsCreated;
        observationsUpdated += obsResult.observationsUpdated;

        // generate hypotheses for new observations
        if (tileObsCreated > 0) {
          const newObs = await db.observation.findMany({
            where: { mgrsTile: scene.mgrsTile },
            select: { id: true },
            take: tileObsCreated,
            orderBy: { observedAt: "desc" },
          });
          for (const o of newObs) {
            try {
              const hypResult = await generateHypotheses(o.id);
              tileHypCreated += hypResult.hypothesesCreated;
              hypothesesCreated += hypResult.hypothesesCreated;

              // Phase 3.12: Auto-trigger verification missions for new hypotheses
              // This closes the gap between "detected" and "a mission exists to verify it"
              if (hypResult.hypothesesCreated > 0) {
                try {
                  const missionResult = await planMissions({
                    observationId: o.id,
                    confidenceThreshold: 0.6, // lower threshold so missions get created for borderline hypotheses
                  });
                  tileMissionsPlanned += missionResult.created;
                  missionsPlanned += missionResult.created;
                } catch (e) {
                  // non-fatal — missions are best-effort
                  errors.push(`Mission planning for ${o.id}: ${String(e).slice(0, 80)}`);
                }
              }
            } catch (e) {
              errors.push(`Hypotheses for ${o.id}: ${String(e).slice(0, 80)}`);
            }
          }
        }
      } catch (e) {
        errors.push(`Obs/hyp for ${tile.tileId}: ${String(e).slice(0, 80)}`);
      }

      // run temporal merge (links observations into phenomena)
      try {
        const mergeResult = await runTemporalMerge();
        phenomenaCreated += mergeResult.phenomenaCreated;
      } catch (e) {
        // non-fatal
      }

      // mark tile as processed
      await markTileProcessed(tile.tileId, scene.id, tileObsCreated, tileObsCreated > 0 ? "surface_disturbance" : undefined);
      tilesProcessed++;

      emit.worldModelUpdated("continuous-pipeline", tileObsCreated);
    } catch (e) {
      errors.push(`Tile ${tile.tileId}: ${String(e).slice(0, 100)}`);
    }
  }

  // update the processing run
  const finishedAt = new Date();
  await db.processingRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      status: errors.length > 0 && tilesProcessed < tiles.length ? "partial" : "success",
      tilesProcessed,
      tilesTotal: tiles.length,
      scenesProcessed,
      observationsCreated,
      observationsUpdated,
      hypothesesCreated,
      phenomenaCreated,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      error: errors.length > 0 ? errors.join("; ").slice(0, 500) : null,
    },
  });

  emit.connectorCompleted("continuous-pipeline", "Continuous pipeline", tilesProcessed);

  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const status = errors.length > 0 && tilesProcessed < tiles.length ? "partial" : "success";

  if (status === "success") {
    pipeLogger.info("pipeline.complete", {
      tilesProcessed, tilesTotal: tiles.length, scenesProcessed,
      observationsCreated, hypothesesCreated, missionsPlanned,
      durationMs,
    });
  } else {
    pipeLogger.warn("pipeline.partial", {
      tilesProcessed, tilesTotal: tiles.length, errorCount: errors.length,
      durationMs, firstError: errors[0]?.slice(0, 100),
    });
  }

  return {
    runId: run.id,
    tilesProcessed,
    tilesTotal: tiles.length,
    scenesProcessed,
    observationsCreated,
    observationsUpdated,
    hypothesesCreated,
    phenomenaCreated,
    missionsPlanned,
    durationMs,
    status,
    errors,
  };
}

export async function getPipelineStatus(): Promise<any> {
  const [total, processed, pending, stale, lastRun, recentRuns] = await Promise.all([
    db.processingTile.count(),
    db.processingTile.count({ where: { status: "processed" } }),
    db.processingTile.count({ where: { status: "pending" } }),
    db.processingTile.count({ where: { status: "stale" } }),
    db.processingRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.processingRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
  ]);

  return {
    grid: { total, processed, pending, stale, coveragePct: total > 0 ? (processed / total) * 100 : 0 },
    lastRun: lastRun ? {
      id: lastRun.id,
      startedAt: lastRun.startedAt instanceof Date ? lastRun.startedAt.toISOString() : lastRun.startedAt,
      finishedAt: lastRun.finishedAt instanceof Date ? lastRun.finishedAt.toISOString() : lastRun.finishedAt,
      status: lastRun.status,
      tilesProcessed: lastRun.tilesProcessed,
      tilesTotal: lastRun.tilesTotal,
      observationsCreated: lastRun.observationsCreated,
      hypothesesCreated: lastRun.hypothesesCreated,
      durationMs: lastRun.durationMs,
    } : null,
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      status: r.status,
      tilesProcessed: r.tilesProcessed,
      observationsCreated: r.observationsCreated,
    })),
  };
}
