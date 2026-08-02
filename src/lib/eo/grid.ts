// Ghana Digital Twin — Raster Grid Utilities
// Gridded raster data representation for intelligence products.
// Grids are flattened Float32Array with a spatial extent (bbox).

export interface GridExtent {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface RasterGrid {
  size: number; // grid is size × size
  extent: GridExtent;
  values: Float32Array; // length = size * size, row-major (row 0 = north)
  nodata: number; // value representing no-data (NaN)
}

export function createGrid(size: number, extent: GridExtent, fill = NaN): RasterGrid {
  return {
    size,
    extent,
    values: new Float32Array(size * size).fill(fill),
    nodata: NaN,
  };
}

export function gridGet(g: RasterGrid, row: number, col: number): number {
  if (row < 0 || row >= g.size || col < 0 || col >= g.size) return NaN;
  return g.values[row * g.size + col];
}

export function gridSet(g: RasterGrid, row: number, col: number, v: number): void {
  if (row < 0 || row >= g.size || col < 0 || col >= g.size) return;
  g.values[row * g.size + col] = v;
}

/** Convert grid cell (row, col) to lng/lat of cell center. */
export function cellToLngLat(g: RasterGrid, row: number, col: number): [number, number] {
  const { extent, size } = g;
  const cellW = (extent.maxLng - extent.minLng) / size;
  const cellH = (extent.maxLat - extent.minLat) / size;
  const lng = extent.minLng + (col + 0.5) * cellW;
  const lat = extent.maxLat - (row + 0.5) * cellH;
  return [lng, lat];
}

/** Find the nearest grid cell for a lng/lat. */
export function lngLatToCell(g: RasterGrid, lng: number, lat: number): [number, number] {
  const { extent, size } = g;
  const cellW = (extent.maxLng - extent.minLng) / size;
  const cellH = (extent.maxLat - extent.minLat) / size;
  const col = Math.floor((lng - extent.minLng) / cellW);
  const row = Math.floor((extent.maxLat - lat) / cellH);
  return [Math.max(0, Math.min(size - 1, row)), Math.max(0, Math.min(size - 1, col))];
}

/** Serialize a grid to JSON (flattened number array). */
export function gridToJson(g: RasterGrid): string {
  return JSON.stringify(Array.from(g.values));
}

/** Deserialize a grid from JSON. */
export function jsonToGrid(json: string, size: number, extent: GridExtent): RasterGrid {
  const arr = JSON.parse(json) as number[];
  const values = new Float32Array(arr);
  return { size, extent, values, nodata: NaN };
}

/** Compute stats over valid (finite) grid cells. */
export function gridStats(g: RasterGrid): {
  mean: number;
  min: number;
  max: number;
  std: number;
  validCount: number;
  totalCount: number;
} {
  let n = 0, sum = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < g.values.length; i++) {
    const v = g.values[i];
    if (Number.isFinite(v)) {
      n++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (n === 0) return { mean: NaN, min: NaN, max: NaN, std: NaN, validCount: 0, totalCount: g.values.length };
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < g.values.length; i++) {
    const v = g.values[i];
    if (Number.isFinite(v)) varSum += (v - mean) ** 2;
  }
  return { mean, min, max, std: Math.sqrt(varSum / n), validCount: n, totalCount: g.values.length };
}

/** Map a function over two grids cell-by-cell (same size required). */
export function gridCombine(
  a: RasterGrid,
  b: RasterGrid,
  fn: (va: number, vb: number, i: number) => number
): RasterGrid {
  const out = createGrid(a.size, a.extent);
  for (let i = 0; i < a.values.length; i++) {
    out.values[i] = fn(a.values[i], b.values[i], i);
  }
  return out;
}

/** Map a function over a single grid. */
export function gridMap(g: RasterGrid, fn: (v: number, i: number) => number): RasterGrid {
  const out = createGrid(g.size, g.extent);
  for (let i = 0; i < g.values.length; i++) {
    out.values[i] = fn(g.values[i], i);
  }
  return out;
}

// Uncertainty helpers
export function uncertaintyGrid(size: number, extent: GridExtent, fill: number): RasterGrid {
  return createGrid(size, extent, fill);
}

/** Propagate uncertainty through addition/subtraction: σ = sqrt(σa² + σb²). */
export function propagateAddUncertainty(sa: RasterGrid, sb: RasterGrid): RasterGrid {
  return gridCombine(sa, sb, (va, vb) => Math.sqrt(va * va + vb * vb));
}

/** Propagate through division (a/b): σ = |a/b| * sqrt((σa/a)² + (σb/b)²). */
export function propagateDivUncertainty(
  a: RasterGrid, sa: RasterGrid, b: RasterGrid, sb: RasterGrid
): RasterGrid {
  const out = createGrid(a.size, a.extent);
  for (let i = 0; i < a.values.length; i++) {
    const va = a.values[i], vb = b.values[i];
    if (!Number.isFinite(va) || !Number.isFinite(vb) || vb === 0) {
      out.values[i] = NaN;
    } else {
      const relA = va !== 0 ? sa.values[i] / Math.abs(va) : 0;
      const relB = vb !== 0 ? sb.values[i] / Math.abs(vb) : 0;
      out.values[i] = Math.abs(va / vb) * Math.sqrt(relA * relA + relB * relB);
    }
  }
  return out;
}
