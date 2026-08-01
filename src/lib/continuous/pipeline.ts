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
import { emit } from "@/lib/worldmodel/event-bus";

export interface PipelineResult {
  runId: string;
  tilesProcessed: number;
  tilesTotal: number;
  scenesProcessed: number;
  observationsCreated: number;
  observationsUpdated: number;
  hypothesesCreated: number;
  phenomenaCreated: number;
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
          await computeProduct({ type: pt, sceneId: scene.id, mgrsTile: scene.mgrsTile });
        } catch (e) {
          errors.push(`Product ${pt} for ${scene.stacId}: ${String(e).slice(0, 100)}`);
        }
      }

      // generate observations for this tile
      let tileObsCreated = 0;
      let tileHypCreated = 0;
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

  return {
    runId: run.id,
    tilesProcessed,
    tilesTotal: tiles.length,
    scenesProcessed,
    observationsCreated,
    observationsUpdated,
    hypothesesCreated,
    phenomenaCreated,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status: errors.length > 0 && tilesProcessed < tiles.length ? "partial" : "success",
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
