// Ghana Digital Twin — Spatial Clustering
// Flood-fill connected anomaly cells from raster product grids → candidate
// observation polygons. Each cluster becomes one candidate observation.

import { type RasterGrid, cellToLngLat } from "@/lib/eo/grid";

export interface Cluster {
  cells: [number, number][]; // (row, col) pairs
  size: number;
  centroidLng: number;
  centroidLat: number;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  // per-cell values (for evidence gathering)
  cellValues: Map<string, number>; // "row,col" → value
}

/**
 * Flood-fill: find connected clusters of cells where the predicate is true.
 * Uses 8-connectivity. Returns clusters sorted by size (largest first).
 */
export function findClusters(
  grid: RasterGrid,
  predicate: (row: number, col: number, value: number) => boolean,
  minClusterSize = 3
): Cluster[] {
  const size = grid.size;
  const visited = new Uint8Array(size * size);
  const clusters: Cluster[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = row * size + col;
      if (visited[idx]) continue;
      const v = grid.values[idx];
      if (!predicate(row, col, v)) continue;

      // BFS flood fill
      const queue: [number, number][] = [[row, col]];
      visited[idx] = 1;
      const cells: [number, number][] = [];
      const cellValues = new Map<string, number>();
      let sumLng = 0, sumLat = 0;
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

      while (queue.length > 0) {
        const [r, c] = queue.shift()!;
        cells.push([r, c]);
        const val = grid.values[r * size + c];
        cellValues.set(`${r},${c}`, val);
        const [lng, lat] = cellToLngLat(grid, r, c);
        sumLng += lng;
        sumLat += lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;

        // 8-connectivity neighbors
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            const nidx = nr * size + nc;
            if (visited[nidx]) continue;
            const nv = grid.values[nidx];
            if (!predicate(nr, nc, nv)) continue;
            visited[nidx] = 1;
            queue.push([nr, nc]);
          }
        }
      }

      if (cells.length >= minClusterSize) {
        clusters.push({
          cells,
          size: cells.length,
          centroidLng: sumLng / cells.length,
          centroidLat: sumLat / cells.length,
          minLng,
          minLat,
          maxLng,
          maxLat,
          cellValues,
        });
      }
    }
  }

  clusters.sort((a, b) => b.size - a.size);
  return clusters;
}

/**
 * Build a polygon geometry from a cluster (convex hull of cell centers).
 * For simplicity, uses the bounding box as the geometry — a reasonable
 * approximation for a 50×50 grid where each cell is ~1km.
 */
export function clusterToPolygon(cluster: Cluster): GeoJSON.Polygon {
  // Use the cluster's bounding box as the observation geometry.
  // Add a small buffer to ensure the polygon is valid.
  const buffer = 0.005; // ~500m
  return {
    type: "Polygon",
    coordinates: [[
      [cluster.minLng - buffer, cluster.minLat - buffer],
      [cluster.maxLng + buffer, cluster.minLat - buffer],
      [cluster.maxLng + buffer, cluster.maxLat + buffer],
      [cluster.minLng - buffer, cluster.maxLat + buffer],
      [cluster.minLng - buffer, cluster.minLat - buffer],
    ]],
  };
}

/**
 * Estimate area in hectares from a cluster's bounding box.
 */
export function clusterAreaHa(cluster: Cluster): number {
  const lngRange = cluster.maxLng - cluster.minLng;
  const latRange = cluster.maxLat - cluster.minLat;
  // approximate degrees → km (at Ghana's latitude ~7°N, 1° lng ≈ 111km, 1° lat ≈ 111km)
  const areaKm2 = lngRange * 111 * latRange * 111;
  return areaKm2 * 100; // km² → ha
}
