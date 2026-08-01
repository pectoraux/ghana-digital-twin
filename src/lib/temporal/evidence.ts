// Ghana Digital Twin — Evidence Service
// Evidence as first-class immutable objects. Extracted from raster products,
// reusable across multiple observations. Each evidence carries full lineage.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { jsonToGrid, type GridExtent } from "@/lib/eo/grid";
import { computeBBox, computeCentroid } from "@/lib/worldmodel/geometry";

export interface EvidenceRecord {
  id: string;
  uuid: string;
  productType: string;
  indexName: string | null;
  productId: string | null;
  geometry: GeoJSON.Geometry;
  centroid: [number, number];
  observedAt: string;
  value: number;
  normalizedSignal: number;
  confidence: number;
  uncertainty: number;
  direction: string;
  description: string;
  supportingPixels: number;
  supportingSceneId: string | null;
  supportingBandHrefs: string[];
  createdAt: string;
}

/**
 * Extract standalone evidence objects from a raster product.
 * For each significant cell (above threshold), create an Evidence record.
 * These are immutable and can be referenced by multiple observations.
 */
export async function extractEvidenceFromProduct(
  productId: string,
  signalThreshold = 0.15
): Promise<number> {
  const product = await db.rasterProduct.findUnique({
    where: { id: productId },
  });
  if (!product) return 0;

  // load the scene separately (sceneId is a string, not a relation)
  let scene: any = null;
  if (product.sceneId) {
    scene = await db.rasterScene.findUnique({
      where: { id: product.sceneId },
      include: { bands: { select: { name: true, href: true } } },
    });
  }

  const extent: GridExtent = {
    minLng: product.minLng, minLat: product.minLat, maxLng: product.maxLng, maxLat: product.maxLat,
  };
  const valueGrid = jsonToGrid(product.valueGrid, product.gridSize, extent);
  const uncGrid = jsonToGrid(product.uncertaintyGrid, product.gridSize, extent);
  const size = product.gridSize;
  const observedAt = scene?.datetime ?? product.computedAt;

  let created = 0;
  const cellW = (extent.maxLng - extent.minLng) / size;
  const cellH = (extent.maxLat - extent.minLat) / size;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = row * size + col;
      const value = valueGrid.values[idx];
      if (!Number.isFinite(value)) continue;

      const signal = extractSignal(product.type, value);
      if (signal < signalThreshold) continue;

      // cell center lng/lat
      const lng = extent.minLng + (col + 0.5) * cellW;
      const lat = extent.maxLat - (row + 0.5) * cellH;
      const geometry: GeoJSON.Point = { type: "Point", coordinates: [lng, lat] };
      const uncertainty = uncGrid.values[idx] || 0.1;
      const direction = extractDirection(product.type, value);
      const description = describeEvidence(product.type, product.indexName, value, signal);

      // dedupe: check if evidence already exists for this product + location
      const existing = await db.evidence.findFirst({
        where: {
          productId,
          centroidLng: { gte: lng - 0.001, lte: lng + 0.001 },
          centroidLat: { gte: lat - 0.001, lte: lat + 0.001 },
        },
        select: { id: true },
      });
      if (existing) continue;

      await db.evidence.create({
        data: {
          uuid: uuidv4(),
          productType: product.type,
          indexName: product.indexName,
          productId,
          geometryGeoJson: JSON.stringify(geometry),
          centroidLng: lng,
          centroidLat: lat,
          observedAt,
          value,
          normalizedSignal: signal,
          confidence: product.confidence,
          uncertainty,
          direction,
          description,
          supportingPixels: 1,
          supportingSceneId: scene?.id ?? null,
          supportingBandHrefs: JSON.stringify(
            (scene?.bands ?? []).slice(0, 4).map((b) => b.href)
          ),
        },
      });
      created++;
    }
  }
  return created;
}

function extractSignal(productType: string, value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (productType.includes("anomaly")) {
    return Math.min(1, Math.abs(value) / 3);
  }
  if (productType === "change_probability") return Math.min(1, value);
  if (productType === "bare_soil") return Math.max(0, (value - 0.4) / 0.6);
  if (productType === "burn_severity") return Math.min(1, Math.max(0, value) / 0.5);
  if (productType === "temporal_variance") return Math.min(1, value / 0.1);
  return Math.min(1, Math.abs(value));
}

function extractDirection(productType: string, value: number): string {
  if (productType.includes("anomaly")) {
    return value < -1 ? "loss" : value > 1 ? "gain" : "neutral";
  }
  if (productType === "bare_soil") return value > 0.5 ? "gain" : "neutral";
  if (productType === "change_probability") return value > 0.5 ? "loss" : "neutral";
  return "neutral";
}

function describeEvidence(productType: string, indexName: string | null, value: number, signal: number): string {
  const pct = (signal * 100).toFixed(0);
  if (productType === "vegetation_anomaly") {
    return `NDVI anomaly z=${value.toFixed(2)} (${value < 0 ? "vegetation loss" : "vegetation gain"} signal ${pct}%)`;
  }
  if (productType === "water_anomaly") {
    return `NDWI anomaly z=${value.toFixed(2)} (water change signal ${pct}%)`;
  }
  if (productType === "bare_soil") {
    return `Bare soil likelihood ${(value * 100).toFixed(0)}% (excess signal ${pct}%)`;
  }
  if (productType === "change_probability") {
    return `Change probability ${(value * 100).toFixed(0)}%`;
  }
  if (productType === "burn_severity") {
    return `dNBR ${value.toFixed(3)} (burn signal ${pct}%)`;
  }
  return `${productType} = ${value.toFixed(3)} (signal ${pct}%)`;
}

export async function getEvidenceNear(lng: number, lat: number, radiusDeg = 0.05): Promise<EvidenceRecord[]> {
  const rows = await db.evidence.findMany({
    where: {
      centroidLng: { gte: lng - radiusDeg, lte: lng + radiusDeg },
      centroidLat: { gte: lat - radiusDeg, lte: lat + radiusDeg },
    },
    orderBy: { normalizedSignal: "desc" },
    take: 100,
  });
  return rows.map(rowToEvidence);
}

export async function getEvidenceForObservation(observationId: string): Promise<EvidenceRecord[]> {
  const links = await db.observationEvidenceLink.findMany({
    where: { observationId },
    include: { evidence: true },
  });
  return links.map((l) => rowToEvidence(l.evidence));
}

export async function listEvidence(opts: { productType?: string; limit?: number } = {}): Promise<EvidenceRecord[]> {
  const rows = await db.evidence.findMany({
    where: opts.productType ? { productType: opts.productType } : {},
    orderBy: { normalizedSignal: "desc" },
    take: opts.limit ?? 200,
  });
  return rows.map(rowToEvidence);
}

function rowToEvidence(r: any): EvidenceRecord {
  return {
    id: r.id,
    uuid: r.uuid,
    productType: r.productType,
    indexName: r.indexName,
    productId: r.productId,
    geometry: JSON.parse(r.geometryGeoJson),
    centroid: [r.centroidLng, r.centroidLat],
    observedAt: r.observedAt instanceof Date ? r.observedAt.toISOString() : r.observedAt,
    value: r.value,
    normalizedSignal: r.normalizedSignal,
    confidence: r.confidence,
    uncertainty: r.uncertainty,
    direction: r.direction,
    description: r.description,
    supportingPixels: r.supportingPixels,
    supportingSceneId: r.supportingSceneId,
    supportingBandHrefs: JSON.parse(r.supportingBandHrefs || "[]"),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

export async function countEvidence(): Promise<number> {
  return db.evidence.count();
}
