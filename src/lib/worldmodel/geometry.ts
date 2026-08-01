// Ghana Digital Twin — Geometry & Spatial Service
// Production spatial operations. Uses turf for precise geometry math.
// Storage layer stores GeoJSON + bbox/centroid columns; this module provides
// the spatial functions (contains, intersects, distance, buffer, nearest-neighbor).

import * as turf from "@turf/turf";
import type { LngLat } from "@/lib/gdt/geo";

export type Geometry = GeoJSON.Geometry;
export type Feature = GeoJSON.Feature;
export type FeatureCollection = GeoJSON.FeatureCollection;

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// ---- BBox / centroid computation ----
export function computeBBox(geometry: Geometry): BBox {
  const bbox = turf.bbox(geometry); // [minLng, minLat, maxLng, maxLat]
  return {
    minLng: bbox[0],
    minLat: bbox[1],
    maxLng: bbox[2],
    maxLat: bbox[3],
  };
}

export function computeCentroid(geometry: Geometry): LngLat {
  const c = turf.centroid(turf.feature(geometry));
  const [lng, lat] = c.geometry.coordinates;
  return [lng, lat];
}

export function computeAreaKm2(geometry: Geometry): number | null {
  try {
    // Only meaningful for polygons/multipolygons
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      return turf.area(turf.feature(geometry)) / 1_000_000; // m² → km²
    }
    return null;
  } catch {
    return null;
  }
}

export function computeLengthKm(geometry: Geometry): number | null {
  try {
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      return turf.length(turf.feature(geometry), { units: "kilometers" });
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Spatial predicates ----
export function bboxIntersects(a: BBox, b: BBox): boolean {
  return (
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng &&
    a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat
  );
}

export function bboxContains(outer: BBox, inner: BBox): boolean {
  return (
    outer.minLng <= inner.minLng &&
    outer.maxLng >= inner.maxLng &&
    outer.minLat <= inner.minLat &&
    outer.maxLat >= inner.maxLat
  );
}

export function pointInBBox(lng: number, lat: number, b: BBox): boolean {
  return lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat;
}

export function geometryContains(outer: Geometry, inner: Geometry): boolean {
  try {
    return turf.booleanContains(turf.feature(outer), turf.feature(inner));
  } catch {
    return false;
  }
}

export function geometryIntersects(a: Geometry, b: Geometry): boolean {
  try {
    return turf.booleanIntersects(turf.feature(a), turf.feature(b));
  } catch {
    return false;
  }
}

export function pointInGeometry(lng: number, lat: number, geom: Geometry): boolean {
  try {
    const pt = turf.point([lng, lat]);
    return turf.booleanPointInPolygon(pt, geom as GeoJSON.Polygon | GeoJSON.MultiPolygon);
  } catch {
    return false;
  }
}

// ---- Distance ----
export function haversineKm(a: LngLat, b: LngLat): number {
  return turf.distance(turf.point(a), turf.point(b), { units: "kilometers" });
}

export function distancePointToGeometryKm(lng: number, lat: number, geom: Geometry): number {
  try {
    const pt = turf.point([lng, lat]);
    return turf.distance(pt, turf.feature(geom), { units: "kilometers" });
  } catch {
    // fallback to centroid distance
    const c = computeCentroid(geom);
    return haversineKm([lng, lat], c);
  }
}

// ---- Buffer ----
export function bufferKm(geom: Geometry, km: number): Geometry | null {
  try {
    const buf = turf.buffer(turf.feature(geom), km, { units: "kilometers" });
    return buf?.geometry ?? null;
  } catch {
    return null;
  }
}

// ---- Normalization: ensure valid GeoJSON geometry ----
export function normalizeGeometry(geom: unknown): Geometry | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as Geometry;
  if (!g.type || !g.coordinates) return null;
  const validTypes = [
    "Point",
    "MultiPoint",
    "LineString",
    "MultiLineString",
    "Polygon",
    "MultiPolygon",
    "GeometryCollection",
  ];
  if (!validTypes.includes(g.type)) return null;
  // turf will throw on malformed; validate by computing bbox
  try {
    turf.bbox(g);
    return g;
  } catch {
    return null;
  }
}

// Coerce a GeoJSON Feature or FeatureCollection geometry into a single geometry
export function coerceToGeometry(input: unknown): Geometry | null {
  if (!input) return null;
  if (typeof input !== "object") return null;
  // Direct geometry
  if ((input as Geometry).type && (input as Geometry).coordinates) {
    return normalizeGeometry(input);
  }
  // Feature
  const feat = input as Partial<Feature>;
  if (feat.type === "Feature" && feat.geometry) {
    return normalizeGeometry(feat.geometry);
  }
  // FeatureCollection → merge polygons into MultiPolygon (best effort)
  const fc = input as Partial<FeatureCollection>;
  if (fc.type === "FeatureCollection" && Array.isArray(fc.features)) {
    const polys: GeoJSON.Polygon[] = [];
    for (const f of fc.features) {
      const gg = f.geometry;
      if (!gg) continue;
      if (gg.type === "Polygon") polys.push(gg);
      else if (gg.type === "MultiPolygon") polys.push(...gg.coordinates.map((c) => ({ type: "Polygon" as const, coordinates: c })));
    }
    if (polys.length === 1) return normalizeGeometry(polys[0]);
    if (polys.length > 1) {
      return normalizeGeometry({
        type: "MultiPolygon",
        coordinates: polys.map((p) => p.coordinates),
      });
    }
    // fallback: first feature geometry
    const first = fc.features.find((f) => f.geometry);
    return first?.geometry ? normalizeGeometry(first.geometry) : null;
  }
  return null;
}

// Determine a region id for a geometry given a set of region polygons (point-in-polygon on centroid)
export function locateInRegions(
  geom: Geometry,
  regions: { id: string; geometry: Geometry }[]
): string | null {
  try {
    const c = computeCentroid(geom);
    for (const r of regions) {
      if (pointInGeometry(c[0], c[1], r.geometry)) return r.id;
    }
    return null;
  } catch {
    return null;
  }
}

// Simplify geometry to reduce storage (Douglas-Peucker)
export function simplifyGeometry(geom: Geometry, toleranceKm = 0.005): Geometry | null {
  try {
    const simplified = turf.simplify(turf.feature(geom), { tolerance: toleranceKm, highQuality: false });
    return simplified?.geometry ?? null;
  } catch {
    return geom;
  }
}

export function parseGeometry(geoJsonStr: string): Geometry | null {
  try {
    return normalizeGeometry(JSON.parse(geoJsonStr));
  } catch {
    return null;
  }
}
