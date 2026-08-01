// Ghana Digital Twin — Evidence Fusion Engine
// Fuses multiple raster products into a single observation. An observation
// NEVER depends on a single product — it requires multiple independent evidence
// sources. Fused confidence + uncertainty are propagated from all evidence.

import { db } from "@/lib/db";
import { jsonToGrid, type RasterGrid, type GridExtent } from "@/lib/eo/grid";
import { FUSION_RULES, type ObservationType, type EvidencePiece, type FusedObservation, type Severity } from "./types";
import { findClusters, clusterToPolygon, clusterAreaHa, type Cluster } from "./clustering";

// Load a raster product's grid from the DB
async function loadProductGrid(productId: string): Promise<{ grid: RasterGrid; product: any } | null> {
  const product = await db.rasterProduct.findUnique({ where: { id: productId } });
  if (!product) return null;
  const extent: GridExtent = {
    minLng: product.minLng,
    minLat: product.minLat,
    maxLng: product.maxLng,
    maxLat: product.maxLat,
  };
  const grid = jsonToGrid(product.valueGrid, product.gridSize, extent);
  return { grid, product };
}

// Find products that overlap a given MGRS tile and have the required types
async function findProductsForTile(mgrsTile: string, productTypes: string[]): Promise<{ type: string; id: string; indexName: string | null }[]> {
  const products = await db.rasterProduct.findMany({
    where: { mgrsTile, type: { in: productTypes } },
    orderBy: { computedAt: "desc" },
    select: { id: true, type: true, indexName: true, computedAt: true },
  });
  // take the most recent product of each type
  const byType = new Map<string, { type: string; id: string; indexName: string | null }>();
  for (const p of products) {
    if (!byType.has(p.type)) {
      byType.set(p.type, { type: p.type, id: p.id, indexName: p.indexName });
    }
  }
  return Array.from(byType.values());
}

// For a cluster, gather the value of each product at the cluster centroid cell
function getProductValueAtCluster(grid: RasterGrid, cluster: Cluster): number {
  // use the cluster centroid cell (nearest to centroid)
  const size = grid.size;
  const extent = grid.extent;
  const cellW = (extent.maxLng - extent.minLng) / size;
  const cellH = (extent.maxLat - extent.minLat) / size;
  const col = Math.floor((cluster.centroidLng - extent.minLng) / cellW);
  const row = Math.floor((extent.maxLat - cluster.centroidLat) / cellH);
  const r = Math.max(0, Math.min(size - 1, row));
  const c = Math.max(0, Math.min(size - 1, col));
  return grid.values[r * size + c];
}

// Average value over all cluster cells (more robust than single centroid)
function getProductValueAvgOverCluster(grid: RasterGrid, cluster: Cluster): number {
  const size = grid.size;
  const extent = grid.extent;
  const cellW = (extent.maxLng - extent.minLng) / size;
  const cellH = (extent.maxLat - extent.minLat) / size;
  let sum = 0;
  let count = 0;
  for (const [row, col] of cluster.cells) {
    // map cluster cell (in cluster's grid) to this product's grid
    const [lng, lat] = cellToLngLatFromCluster(cluster, row, col);
    const c = Math.floor((lng - extent.minLng) / cellW);
    const r = Math.floor((extent.maxLat - lat) / cellH);
    if (r >= 0 && r < size && c >= 0 && c < size) {
      const v = grid.values[r * size + c];
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
  }
  return count > 0 ? sum / count : NaN;
}

// cellToLngLat for cluster cells (cluster has its own grid extent)
function cellToLngLatFromCluster(cluster: Cluster, row: number, col: number): [number, number] {
  // clusters don't store their grid extent directly, but we can compute from bbox + size
  // Actually we need the original grid's extent. For simplicity, use the cluster's bbox.
  const size = 50; // GRID_SIZE
  const cellW = (cluster.maxLng - cluster.minLng) / size;
  const cellH = (cluster.maxLat - cluster.minLat) / size;
  const lng = cluster.minLng + (col + 0.5) * cellW;
  const lat = cluster.maxLat - (row + 0.5) * cellH;
  return [lng, lat];
}

/**
 * Fuse evidence from multiple raster products for a given observation type and MGRS tile.
 * Returns fused observations for each detected cluster.
 */
export async function fuseObservations(
  type: ObservationType,
  mgrsTile: string
): Promise<{ observations: Array<FusedObservation & { cluster: Cluster; polygon: GeoJSON.Polygon; areaHa: number }>; productIds: string[] }> {
  const rule = FUSION_RULES[type];
  if (!rule) return { observations: [], productIds: [] };

  // find available products for this tile
  const productTypes = rule.evidenceSources.map((s) => s.productType);
  const available = await findProductsForTile(mgrsTile, productTypes);

  if (available.length < rule.minEvidenceSources) {
    return { observations: [], productIds: [] };
  }

  // load grids for all available products
  const grids: { type: string; grid: RasterGrid; product: any; source: typeof rule.evidenceSources[0] }[] = [];
  for (const a of available) {
    const loaded = await loadProductGrid(a.id);
    if (!loaded) continue;
    const source = rule.evidenceSources.find((s) => s.productType === a.type);
    if (!source) continue;
    grids.push({ type: a.type, grid: loaded.grid, product: loaded.product, source });
  }

  if (grids.length < rule.minEvidenceSources) {
    return { observations: [], productIds: [] };
  }

  // build a combined anomaly mask: a cell is a candidate if ANY product's signal > 0
  // We'll use the first grid's extent as the reference (all products for the same tile should have the same extent)
  const refGrid = grids[0].grid;
  const size = refGrid.size;
  const combinedSignal = new Float32Array(size * size);

  for (const g of grids) {
    for (let i = 0; i < size * size; i++) {
      const v = g.grid.values[i];
      const { signal } = g.source.extractSignal(v);
      if (Number.isFinite(signal)) {
        combinedSignal[i] = Math.max(combinedSignal[i], signal);
      }
    }
  }

  // find clusters where combined signal > threshold/2 (lower threshold for clustering, fusion will filter)
  const clusterGrid: RasterGrid = { size, extent: refGrid.extent, values: combinedSignal, nodata: NaN };
  const clusters = findClusters(
    clusterGrid,
    (_row, _col, v) => Number.isFinite(v) && v > rule.threshold * 0.5,
    2 // min cluster size
  );

  // for each cluster, gather evidence from all products and fuse
  const observations: Array<FusedObservation & { cluster: Cluster; polygon: GeoJSON.Polygon; areaHa: number }> = [];
  const productIds = grids.map((g) => g.product.id);

  for (const cluster of clusters) {
    const evidence: EvidencePiece[] = [];

    for (const g of grids) {
      const value = getProductValueAvgOverCluster(g.grid, cluster);
      if (!Number.isFinite(value)) continue;
      const { signal, direction } = g.source.extractSignal(value);
      if (signal <= 0) continue;

      const contribution = g.source.weight * signal;
      const confidence = g.product.confidence ?? 0.8;
      // uncertainty from the product's grid (read the uncertainty grid)
      const uncValue = await getProductUncertainty(g.product.id, cluster);

      evidence.push({
        productType: g.type,
        productId: g.product.id,
        indexName: g.product.indexName,
        value,
        normalizedSignal: signal,
        weight: g.source.weight,
        confidence,
        uncertainty: uncValue,
        contribution,
        description: g.source.description(value, signal),
        direction,
      });
    }

    if (evidence.length < rule.minEvidenceSources) continue;

    // fuse: weighted average of signals
    const totalWeight = evidence.reduce((a, e) => a + e.weight, 0);
    const fusedSignal = evidence.reduce((a, e) => a + e.contribution, 0) / totalWeight;

    if (fusedSignal < rule.threshold) continue;

    // fused confidence: average of evidence confidences weighted by their contribution
    const totalContribution = evidence.reduce((a, e) => a + e.contribution, 0);
    const fusedConfidence = totalContribution > 0
      ? evidence.reduce((a, e) => a + e.confidence * e.contribution, 0) / totalContribution
      : 0.5;

    // fused uncertainty: root-mean-square of evidence uncertainties
    const fusedUncertainty = Math.sqrt(
      evidence.reduce((a, e) => a + e.uncertainty ** 2, 0) / evidence.length
    );

    const areaHa = clusterAreaHa(cluster);
    const severity = rule.severityFromSignal(fusedSignal, areaHa);
    const polygon = clusterToPolygon(cluster);

    observations.push({
      type,
      fusedSignal,
      fusedConfidence,
      fusedUncertainty,
      evidence,
      evidenceCount: evidence.length,
      severity,
      cluster,
      polygon,
      areaHa,
    });
  }

  return { observations, productIds };
}

// Read the uncertainty grid value at a cluster location
async function getProductUncertainty(productId: string, cluster: Cluster): Promise<number> {
  try {
    const product = await db.rasterProduct.findUnique({ where: { id: productId } });
    if (!product) return 0.1;
    const extent: GridExtent = {
      minLng: product.minLng, minLat: product.minLat, maxLng: product.maxLng, maxLat: product.maxLat,
    };
    const uncGrid = jsonToGrid(product.uncertaintyGrid, product.gridSize, extent);
    // average uncertainty over cluster cells
    const val = getProductValueAvgOverCluster(uncGrid, cluster);
    return Number.isFinite(val) ? val : 0.1;
  } catch {
    return 0.1;
  }
}
