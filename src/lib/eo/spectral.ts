// Ghana Digital Twin — Spectral Indices Engine
// Computes real spectral indices from real Sentinel-2 band COGs over HTTP.
// Each formula is applied to windowed pixel reads; statistics are cached.

import { fromUrl } from "geotiff";
import proj4 from "proj4";
import { db } from "@/lib/db";

export type IndexName = "NDVI" | "NDWI" | "NBR" | "EVI" | "BSI" | "MNDWI" | "SAVI";

export interface IndexDef {
  name: IndexName;
  formula: string;
  bands: string[];
  range: [number, number];
  description: string;
  compute: (bands: Record<string, Uint16Array>) => Float32Array;
}

export const INDICES: Record<IndexName, IndexDef> = {
  NDVI: {
    name: "NDVI",
    formula: "(NIR − Red) / (NIR + Red)",
    bands: ["nir", "red"],
    range: [-1, 1],
    description: "Normalized Difference Vegetation Index — vegetation greenness & biomass.",
    compute: (b) => {
      const nir = b.nir, red = b.red;
      const out = new Float32Array(nir.length);
      for (let i = 0; i < nir.length; i++) {
        const d = nir[i] + red[i];
        out[i] = d === 0 ? NaN : (nir[i] - red[i]) / d;
      }
      return out;
    },
  },
  NDWI: {
    name: "NDWI",
    formula: "(Green − NIR) / (Green + NIR)",
    bands: ["green", "nir"],
    range: [-1, 1],
    description: "Normalized Difference Water Index — open water body extent.",
    compute: (b) => {
      const g = b.green, nir = b.nir;
      const out = new Float32Array(g.length);
      for (let i = 0; i < g.length; i++) {
        const d = g[i] + nir[i];
        out[i] = d === 0 ? NaN : (g[i] - nir[i]) / d;
      }
      return out;
    },
  },
  NBR: {
    name: "NBR",
    formula: "(NIR − SWIR16) / (NIR + SWIR16)",
    bands: ["nir", "swir16"],
    range: [-1, 1],
    description: "Normalized Burn Ratio — burn severity & vegetation stress.",
    compute: (b) => {
      const nir = b.nir, sw = b.swir16;
      const out = new Float32Array(nir.length);
      for (let i = 0; i < nir.length; i++) {
        const d = nir[i] + sw[i];
        out[i] = d === 0 ? NaN : (nir[i] - sw[i]) / d;
      }
      return out;
    },
  },
  EVI: {
    name: "EVI",
    formula: "2.5 × (NIR − Red) / (NIR + 6×Red − 7.5×Blue + 1)",
    bands: ["nir", "red", "blue"],
    range: [-3, 3],
    description: "Enhanced Vegetation Index — vegetation in high-biomass / atmospheric haze.",
    compute: (b) => {
      const nir = b.nir, red = b.red, blue = b.blue;
      const out = new Float32Array(nir.length);
      for (let i = 0; i < nir.length; i++) {
        const denom = nir[i] + 6 * red[i] - 7.5 * blue[i] + 1;
        out[i] = denom === 0 ? NaN : 2.5 * (nir[i] - red[i]) / denom;
      }
      return out;
    },
  },
  BSI: {
    name: "BSI",
    formula: "((SWIR16 + Red) − (NIR + Blue)) / ((SWIR16 + Red) + (NIR + Blue))",
    bands: ["swir16", "red", "nir", "blue"],
    range: [-1, 1],
    description: "Bare Soil Index — exposed soil / bare ground.",
    compute: (b) => {
      const sw = b.swir16, red = b.red, nir = b.nir, blue = b.blue;
      const out = new Float32Array(nir.length);
      for (let i = 0; i < nir.length; i++) {
        const num = (sw[i] + red[i]) - (nir[i] + blue[i]);
        const den = (sw[i] + red[i]) + (nir[i] + blue[i]);
        out[i] = den === 0 ? NaN : num / den;
      }
      return out;
    },
  },
  MNDWI: {
    name: "MNDWI",
    formula: "(Green − SWIR16) / (Green + SWIR16)",
    bands: ["green", "swir16"],
    range: [-1, 1],
    description: "Modified NDWI — water bodies in built-up areas (suppresses built-up confusion).",
    compute: (b) => {
      const g = b.green, sw = b.swir16;
      const out = new Float32Array(g.length);
      for (let i = 0; i < g.length; i++) {
        const d = g[i] + sw[i];
        out[i] = d === 0 ? NaN : (g[i] - sw[i]) / d;
      }
      return out;
    },
  },
  SAVI: {
    name: "SAVI",
    formula: "((NIR − Red) / (NIR + Red + L)) × (1 + L),  L=0.5",
    bands: ["nir", "red"],
    range: [-1.5, 1.5],
    description: "Soil-Adjusted Vegetation Index — vegetation in sparse / arid cover.",
    compute: (b) => {
      const L = 0.5;
      const nir = b.nir, red = b.red;
      const out = new Float32Array(nir.length);
      for (let i = 0; i < nir.length; i++) {
        const d = nir[i] + red[i] + L;
        out[i] = d === 0 ? NaN : ((nir[i] - red[i]) / d) * (1 + L);
      }
      return out;
    },
  },
};

export const INDEX_LIST = Object.values(INDICES);

export interface IndexStats {
  mean: number;
  min: number;
  max: number;
  std: number;
  validPixelPct: number;
}

export function computeStats(arr: Float32Array): IndexStats {
  let n = 0, sum = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      n++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (n === 0) return { mean: NaN, min: NaN, max: NaN, std: NaN, validPixelPct: 0 };
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) varSum += (v - mean) ** 2;
  }
  return { mean, min, max, std: Math.sqrt(varSum / n), validPixelPct: (n / arr.length) * 100 };
}

const cache = new Map<string, { tiff: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getTiff(href: string): Promise<any> {
  const cached = cache.get(href);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tiff;
  const tiff = await fromUrl(href);
  cache.set(href, { tiff, ts: Date.now() });
  return tiff;
}

/** Derive UTM EPSG code from MGRS tile (e.g. "30NYM" → EPSG:32630). */
export function mgrsToEpsg(mgrsTile?: string | null): number | null {
  if (!mgrsTile || mgrsTile.length < 2) return null;
  const zone = parseInt(mgrsTile.slice(0, 2));
  if (isNaN(zone) || zone < 1 || zone > 60) return null;
  // Ghana is in the northern hemisphere → EPSG:326XX
  return 32600 + zone;
}

/** Convert lng/lat to the COG's native UTM coordinates. */
function projectToScene(lng: number, lat: number, epsg: number | null): [number, number] | null {
  if (!epsg) return null;
  try {
    const [x, y] = proj4("EPSG:4326", `EPSG:${epsg}`, [lng, lat]);
    return [x, y];
  } catch {
    return null;
  }
}

export interface WindowRead {
  values: Uint16Array;
  width: number;
  height: number;
}

export async function readBandWindow(
  bandHref: string,
  lng: number,
  lat: number,
  windowSizeM = 1000,
  targetSize = 40,
  mgrsTile?: string | null
): Promise<WindowRead | null> {
  try {
    const tiff = await getTiff(bandHref);
    const image = await tiff.getImage();
    const [ox, oy] = image.getOrigin();
    const [rx, ry] = image.getResolution();
    // convert lng/lat → COG's UTM coordinate system
    const epsg = mgrsToEpsg(mgrsTile);
    const utm = projectToScene(lng, lat, epsg);
    if (!utm) return null;
    const [ux, uy] = utm;
    const px = Math.round((ux - ox) / rx);
    const py = Math.round((uy - oy) / ry);
    const half = Math.max(5, Math.floor(windowSizeM / 2 / Math.abs(rx)));
    const w = image.getWidth(), h = image.getHeight();
    const x0 = Math.max(0, px - half);
    const y0 = Math.max(0, py - half);
    const x1 = Math.min(w, px + half);
    const y1 = Math.min(h, py + half);
    if (x1 <= x0 || y1 <= y0) return null;
    const data = await image.readRasters({ window: [x0, y0, x1, y1], samples: [0], width: targetSize, height: targetSize });
    return { values: new Uint16Array(data[0]), width: targetSize, height: targetSize };
  } catch {
    return null;
  }
}

export async function readBandScene(bandHref: string, targetSize = 200): Promise<WindowRead | null> {
  try {
    const tiff = await getTiff(bandHref);
    const image = await tiff.getImage();
    const data = await image.readRasters({ samples: [0], width: targetSize, height: targetSize });
    return { values: new Uint16Array(data[0]), width: targetSize, height: targetSize };
  } catch {
    return null;
  }
}

export async function readPixelValue(bandHref: string, lng: number, lat: number, mgrsTile?: string | null): Promise<number | null> {
  try {
    const tiff = await getTiff(bandHref);
    const image = await tiff.getImage();
    const [ox, oy] = image.getOrigin();
    const [rx, ry] = image.getResolution();
    const epsg = mgrsToEpsg(mgrsTile);
    const utm = projectToScene(lng, lat, epsg);
    if (!utm) return null;
    const [ux, uy] = utm;
    const px = Math.floor((ux - ox) / rx);
    const py = Math.floor((uy - oy) / ry);
    const w = image.getWidth(), h = image.getHeight();
    if (px < 0 || py < 0 || px >= w || py >= h) return null;
    const data = await image.readRasters({ window: [px, py, px + 1, py + 1], samples: [0] });
    const v = (data[0] as Uint16Array)[0];
    return v ?? null;
  } catch {
    return null;
  }
}

export async function computeSceneIndex(
  sceneId: string,
  indexName: IndexName,
  bands: { name: string; href: string }[]
): Promise<IndexStats | null> {
  const def = INDICES[indexName];
  if (!def) return null;
  const cached = await db.spectralIndexLayer.findUnique({ where: { sceneId_indexName: { sceneId, indexName } } });
  if (cached?.computedAt && cached.meanValue != null) {
    return { mean: cached.meanValue, min: cached.minValue!, max: cached.maxValue!, std: cached.stdValue!, validPixelPct: cached.validPixelPct! };
  }
  const bandMap: Record<string, Uint16Array> = {};
  const targetSize = 200;
  for (const bname of def.bands) {
    const band = bands.find((b) => b.name === bname);
    if (!band) return null;
    const read = await readBandScene(band.href, targetSize);
    if (!read) return null;
    bandMap[bname] = read.values;
  }
  const len = bandMap[def.bands[0]].length;
  for (const b of def.bands) if (bandMap[b].length !== len) return null;
  const indexArr = def.compute(bandMap);
  const stats = computeStats(indexArr);
  await db.spectralIndexLayer.upsert({
    where: { sceneId_indexName: { sceneId, indexName } },
    update: { meanValue: stats.mean, minValue: stats.min, maxValue: stats.max, stdValue: stats.std, validPixelPct: stats.validPixelPct, computedAt: new Date() },
    create: { sceneId, indexName, formula: def.formula, meanValue: stats.mean, minValue: stats.min, maxValue: stats.max, stdValue: stats.std, validPixelPct: stats.validPixelPct, computedAt: new Date() },
  });
  return stats;
}

export async function computeIndexAtPoint(
  bands: { name: string; href: string }[],
  indexName: IndexName,
  lng: number,
  lat: number,
  mgrsTile?: string | null
): Promise<number | null> {
  const def = INDICES[indexName];
  if (!def) return null;
  const bandMap: Record<string, Uint16Array> = {};
  for (const bname of def.bands) {
    const band = bands.find((b) => b.name === bname);
    if (!band) return null;
    const read = await readBandWindow(band.href, lng, lat, 200, 10, mgrsTile);
    if (!read) return null;
    bandMap[bname] = read.values;
  }
  const arr = def.compute(bandMap);
  const center = arr[Math.floor(arr.length / 2)];
  return Number.isFinite(center) ? center : null;
}
