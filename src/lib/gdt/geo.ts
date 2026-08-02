// Ghana Digital Twin — Geography & Projection
// Equirectangular projection scaled to Ghana's bounds.

export type LngLat = [number, number];

export const GHANA_BOUNDS = {
  minLng: -3.65,
  maxLng: 1.6,
  minLat: 4.45,
  maxLat: 11.35,
};

export const GHANA_CENTER: LngLat = [-1.0249, 7.9465];

// Recognizable simplified outline of Ghana (lng, lat), clockwise from NW.
export const GHANA_OUTLINE: LngLat[] = [
  [-3.35, 11.08],
  [-2.0, 11.13],
  [-0.95, 11.1],
  [-0.2, 11.06],
  [0.45, 11.02],
  [0.95, 10.96],
  [1.04, 10.42],
  [1.06, 9.8],
  [1.12, 9.0],
  [1.16, 8.2],
  [1.2, 7.4],
  [1.18, 6.7],
  [1.3, 6.05],
  [1.28, 5.78],
  [1.1, 5.62],
  [0.75, 5.55],
  [0.35, 5.58],
  [-0.05, 5.6],
  [-0.5, 5.52],
  [-0.9, 5.45],
  [-1.3, 5.38],
  [-1.75, 5.3],
  [-2.1, 5.22],
  [-2.55, 5.12],
  [-2.95, 5.02],
  [-3.2, 5.08],
  [-3.3, 5.32],
  [-3.28, 6.0],
  [-3.27, 7.0],
  [-3.26, 8.0],
  [-3.3, 9.0],
  [-3.33, 10.0],
  [-3.35, 11.08],
];

// Lake Volta — the distinctive large reservoir in the east-center.
export const LAKE_VOLTA: LngLat[] = [
  [-0.15, 6.32],
  [0.06, 6.46],
  [0.11, 6.82],
  [0.05, 7.22],
  [-0.06, 7.6],
  [-0.2, 8.0],
  [-0.32, 8.4],
  [-0.42, 8.76],
  [-0.58, 8.96],
  [-0.78, 8.9],
  [-0.82, 8.5],
  [-0.7, 8.1],
  [-0.86, 7.8],
  [-1.06, 7.56],
  [-1.16, 7.2],
  [-1.02, 6.96],
  [-0.82, 6.7],
  [-0.6, 6.46],
  [-0.35, 6.3],
  [-0.15, 6.32],
];

export type Region = {
  id: string;
  name: string;
  code: string;
  capital: string;
  centroid: LngLat;
  areaKm2: number;
  population: number;
  tier: "coastal" | "forest" | "northern" | "transitional";
};

export const REGIONS: Region[] = [
  { id: "gar", name: "Greater Accra", code: "GA", capital: "Accra", centroid: [-0.19, 5.6], areaKm2: 3245, population: 5455692, tier: "coastal" },
  { id: "ash", name: "Ashanti", code: "AS", capital: "Kumasi", centroid: [-1.62, 6.74], areaKm2: 24869, population: 5792187, tier: "forest" },
  { id: "wst", name: "Western", code: "WP", capital: "Takoradi", centroid: [-2.07, 5.1], areaKm2: 13947, population: 2165241, tier: "coastal" },
  { id: "wnr", name: "Western North", code: "WN", capital: "Sefwi Wiawso", centroid: [-2.73, 6.4], areaKm2: 10141, population: 1290984, tier: "forest" },
  { id: "cen", name: "Central", code: "CP", capital: "Cape Coast", centroid: [-1.2, 5.3], areaKm2: 9826, population: 2864833, tier: "coastal" },
  { id: "est", name: "Eastern", code: "EP", capital: "Koforidua", centroid: [-0.45, 6.2], areaKm2: 19231, population: 3310642, tier: "forest" },
  { id: "vol", name: "Volta", code: "VR", capital: "Ho", centroid: [0.45, 6.6], areaKm2: 15650, population: 1685996, tier: "coastal" },
  { id: "oti", name: "Oti", code: "OT", capital: "Dambai", centroid: [0.3, 7.7], areaKm2: 11655, population: 761244, tier: "transitional" },
  { id: "bon", name: "Bono", code: "BO", capital: "Sunyani", centroid: [-2.3, 7.7], areaKm2: 11611, population: 1266129, tier: "transitional" },
  { id: "bne", name: "Bono East", code: "BE", capital: "Techiman", centroid: [-1.55, 7.75], areaKm2: 13583, population: 668150, tier: "transitional" },
  { id: "aha", name: "Ahafo", code: "AH", capital: "Goaso", centroid: [-2.55, 6.85], areaKm2: 6797, population: 599674, tier: "forest" },
  { id: "nor", name: "Northern", code: "NR", capital: "Tamale", centroid: [-0.84, 9.4], areaKm2: 25447, population: 2631573, tier: "northern" },
  { id: "sav", name: "Savannah", code: "SV", capital: "Damongo", centroid: [-1.55, 8.9], areaKm2: 34786, population: 649630, tier: "northern" },
  { id: "ner", name: "North East", code: "NE", capital: "Nalerigu", centroid: [-0.5, 10.3], areaKm2: 5728, population: 658903, tier: "northern" },
  { id: "upe", name: "Upper East", code: "UE", capital: "Bolgatanga", centroid: [-0.85, 10.78], areaKm2: 13707, population: 1092866, tier: "northern" },
  { id: "upw", name: "Upper West", code: "UW", capital: "Wa", centroid: [-2.5, 10.2], areaKm2: 18476, population: 904695, tier: "northern" },
];

// Projection: lng/lat -> x/y in a viewBox of width W, height H
export function project(lngLat: LngLat, width: number, height: number): [number, number] {
  const { minLng, maxLng, minLat, maxLat } = GHANA_BOUNDS;
  const x = ((lngLat[0] - minLng) / (maxLng - minLng)) * width;
  const y = ((maxLat - lngLat[1]) / (maxLat - minLat)) * height;
  return [x, y];
}

export function unproject(xy: [number, number], width: number, height: number): LngLat {
  const { minLng, maxLng, minLat, maxLat } = GHANA_BOUNDS;
  const lng = (xy[0] / width) * (maxLng - minLng) + minLng;
  const lat = maxLat - (xy[1] / height) * (maxLat - minLat);
  return [lng, lat];
}

export function pathFromCoords(coords: LngLat[], width: number, height: number, closed = true): string {
  if (coords.length === 0) return "";
  const pts = coords.map((c) => project(c, width, height));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return closed ? `${d} Z` : d;
}

export function formatCoord(lngLat: LngLat): string {
  const [lng, lat] = lngLat;
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

export function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Map viewBox aspect ratio matching Ghana's bounds (height > width).
export const VIEW_W = 760;
export const VIEW_H = 1100;
