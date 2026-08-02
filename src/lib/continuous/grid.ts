// Ghana Digital Twin — Spatial Grid Partitioner
// Divides Ghana into fixed processing tiles for continuous, nationwide coverage.
// Each tile is an independent processing unit that tracks its own state.

import { db } from "@/lib/db";
import { GHANA_BOUNDS, REGIONS } from "@/lib/gdt/geo";

// Grid cell size in degrees (~0.1° ≈ 11km at Ghana's latitude)
const CELL_SIZE_DEG = 0.2; // ~22km tiles — balance between granularity and processing cost

export interface GridCell {
  tileId: string;
  gridRow: number;
  gridCol: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centroidLng: number;
  centroidLat: number;
  regionId: string | null;
}

/**
 * Generate the spatial grid for Ghana and persist to ProcessingTile table.
 * Idempotent — only creates tiles that don't exist.
 */
export async function initializeGrid(): Promise<number> {
  const { minLng, maxLng, minLat, maxLat } = GHANA_BOUNDS;
  const cols = Math.ceil((maxLng - minLng) / CELL_SIZE_DEG);
  const rows = Math.ceil((maxLat - minLat) / CELL_SIZE_DEG);

  let created = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellMinLng = minLng + col * CELL_SIZE_DEG;
      const cellMaxLng = Math.min(maxLng, cellMinLng + CELL_SIZE_DEG);
      const cellMinLat = minLat + row * CELL_SIZE_DEG;
      const cellMaxLat = Math.min(maxLat, cellMinLat + CELL_SIZE_DEG);
      const centroidLng = (cellMinLng + cellMaxLng) / 2;
      const centroidLat = (cellMinLat + cellMaxLat) / 2;

      // check if this cell overlaps Ghana (rough check — within bounds)
      const tileId = `gh-cell-r${row}c${col}`;

      // find overlapping region
      const region = findRegion(centroidLng, centroidLat);

      // check if tile already exists
      const existing = await db.processingTile.findUnique({ where: { tileId } });
      if (existing) continue;

      await db.processingTile.create({
        data: {
          tileId,
          gridRow: row,
          gridCol: col,
          minLng: cellMinLng,
          minLat: cellMinLat,
          maxLng: cellMaxLng,
          maxLat: cellMaxLat,
          centroidLng,
          centroidLat,
          regionId: region,
          status: "pending",
        },
      });
      created++;
    }
  }

  return created;
}

function findRegion(lng: number, lat: number): string | null {
  // nearest region centroid (rough)
  let best: { id: string; d: number } | null = null;
  for (const r of REGIONS) {
    const d = (r.centroid[0] - lng) ** 2 + (r.centroid[1] - lat) ** 2;
    if (!best || d < best.d) best = { id: r.id, d };
  }
  return best?.id ?? null;
}

/**
 * Get tiles that need processing (have new imagery or are stale).
 */
export async function getTilesNeedingProcessing(opts: { limit?: number; regionId?: string } = {}): Promise<any[]> {
  const where: any = {
    status: { in: ["pending", "stale"] },
  };
  if (opts.regionId) where.regionId = opts.regionId;

  const tiles = await db.processingTile.findMany({
    where,
    orderBy: { lastProcessedAt: "asc" }, // process oldest first
    take: opts.limit ?? 50,
  });

  return tiles;
}

/**
 * Get all tiles with their current processing state.
 */
export async function getGridStatus(): Promise<{
  total: number;
  processed: number;
  pending: number;
  stale: number;
  tiles: any[];
}> {
  const [total, processed, pending, stale] = await Promise.all([
    db.processingTile.count(),
    db.processingTile.count({ where: { status: "processed" } }),
    db.processingTile.count({ where: { status: "pending" } }),
    db.processingTile.count({ where: { status: "stale" } }),
  ]);

  const tiles = await db.processingTile.findMany({
    orderBy: { tileId: "asc" },
    take: 500,
    select: {
      tileId: true,
      gridRow: true,
      gridCol: true,
      centroidLng: true,
      centroidLat: true,
      status: true,
      lastProcessedAt: true,
      processingCount: true,
      observationCount: true,
      lastChangeType: true,
      regionId: true,
    },
  });

  return { total, processed, pending, stale, tiles };
}

/**
 * Mark a tile as processed.
 */
export async function markTileProcessed(
  tileId: string,
  sceneId: string | null,
  observationsCreated: number,
  changeType?: string
): Promise<void> {
  await db.processingTile.update({
    where: { tileId },
    data: {
      status: "processed",
      lastProcessedAt: new Date(),
      lastSceneId: sceneId,
      processingCount: { increment: 1 },
      observationCount: { increment: observationsCreated },
      lastChangeAt: observationsCreated > 0 ? new Date() : undefined,
      lastChangeType: changeType,
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark stale tiles (processed > 7 days ago) for reprocessing.
 */
export async function markStaleTiles(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const result = await db.processingTile.updateMany({
    where: {
      status: "processed",
      lastProcessedAt: { lt: sevenDaysAgo },
    },
    data: { status: "stale" },
  });
  return result.count;
}
