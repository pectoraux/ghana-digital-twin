// Ghana Digital Twin — GeoJSON → SVG path rendering
// Converts real GeoJSON geometries (from the world model) into SVG path data
// using the same equirectangular projection as the base map.

import { project, VIEW_W, VIEW_H, type LngLat } from "./geo";
import type { Geometry } from "@/lib/worldmodel/geometry";

function coordToXY(lng: number, lat: number): [number, number] {
  return project([lng, lat], VIEW_W, VIEW_H);
}

/** Convert a GeoJSON geometry into one or more SVG path `d` strings. */
export function geometryToSvgPaths(geom: Geometry): string[] {
  if (!geom || !geom.coordinates) return [];
  const paths: string[] = [];

  const ringToPath = (ring: number[][]): string => {
    if (ring.length === 0) return "";
    return (
      ring
        .map((c, i) => {
          const [x, y] = coordToXY(c[0], c[1]);
          return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ") + " Z"
    );
  };

  const lineToPath = (pts: number[][]): string => {
    if (pts.length === 0) return "";
    return pts
      .map((c, i) => {
        const [x, y] = coordToXY(c[0], c[1]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };

  switch (geom.type) {
    case "Point":
      // represented as a move-to (drawn separately as circle by caller)
      paths.push(`M${coordToXY(geom.coordinates[0], geom.coordinates[1]).map((n) => n.toFixed(2)).join(",")}`);
      break;
    case "MultiPoint":
      geom.coordinates.forEach((c) =>
        paths.push(`M${coordToXY(c[0], c[1]).map((n) => n.toFixed(2)).join(",")}`)
      );
      break;
    case "LineString":
      paths.push(lineToPath(geom.coordinates));
      break;
    case "MultiLineString":
      geom.coordinates.forEach((line) => paths.push(lineToPath(line)));
      break;
    case "Polygon":
      geom.coordinates.forEach((ring) => paths.push(ringToPath(ring)));
      break;
    case "MultiPolygon":
      geom.coordinates.forEach((poly) => poly.forEach((ring) => paths.push(ringToPath(ring))));
      break;
  }
  return paths;
}

/** Project a single point geometry/centroid to SVG xy. */
export function projectLngLat(lngLat: LngLat): [number, number] {
  return coordToXY(lngLat[0], lngLat[1]);
}

/** Get a representative SVG point [x,y] for any geometry (its centroid). */
export function geometryCentroidXY(geom: Geometry): [number, number] {
  switch (geom.type) {
    case "Point":
      return coordToXY(geom.coordinates[0], geom.coordinates[1]);
    default: {
      // bbox center as a cheap centroid
      let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
      const walk = (coords: any) => {
        if (typeof coords[0] === "number") {
          minLng = Math.min(minLng, coords[0]);
          maxLng = Math.max(maxLng, coords[0]);
          minLat = Math.min(minLat, coords[1]);
          maxLat = Math.max(maxLat, coords[1]);
        } else {
          coords.forEach(walk);
        }
      };
      walk(geom.coordinates);
      return coordToXY((minLng + maxLng) / 2, (minLat + maxLat) / 2);
    }
  }
}
