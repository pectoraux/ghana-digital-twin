// Ghana Digital Twin — shared formatting & visual mapping helpers

import type { EntityKind, ObservationType, ObservationStatus } from "./types";

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function fmtInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

export function fmtArea(ha: number): string {
  if (ha >= 1000) return `${(ha / 100).toFixed(1)} km²`;
  return `${ha.toFixed(1)} ha`;
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---- Entity kind → color / label ----
export const ENTITY_META: Record<EntityKind, { color: string; label: string }> = {
  river: { color: "#2dd4bf", label: "River" },
  lake: { color: "#22d3ee", label: "Lake" },
  wetland: { color: "#5eead4", label: "Wetland" },
  forest: { color: "#34d399", label: "Forest" },
  vegetation: { color: "#4ade80", label: "Vegetation" },
  watershed: { color: "#2dd4bf", label: "Watershed" },
  geology: { color: "#a8a29e", label: "Geology" },
  elevation: { color: "#d6d3d1", label: "Elevation" },
  coastline: { color: "#22d3ee", label: "Coastline" },
  road: { color: "#a1a1aa", label: "Road" },
  railway: { color: "#a1a1aa", label: "Railway" },
  bridge: { color: "#d4d4d8", label: "Bridge" },
  airport: { color: "#fbbf24", label: "Airport" },
  port: { color: "#fbbf24", label: "Port" },
  dam: { color: "#f59e0b", label: "Dam" },
  powerline: { color: "#fbbf24", label: "Powerline" },
  building: { color: "#fbbf24", label: "Building" },
  settlement: { color: "#fbbf24", label: "Settlement" },
  region: { color: "#71717a", label: "Region" },
  district: { color: "#71717a", label: "District" },
  protected_area: { color: "#34d399", label: "Protected Area" },
  agriculture: { color: "#a3e635", label: "Agriculture" },
  quarry: { color: "#fb923c", label: "Quarry" },
  excavation: { color: "#f43f5e", label: "Excavation" },
  waterbody_mined: { color: "#f59e0b", label: "Mined Water Body" },
};

export function entityColor(kind: EntityKind): string {
  return ENTITY_META[kind]?.color ?? "#a1a1aa";
}

export function entityTypeLabel(t: string): string {
  return t === "human_activity" ? "Human Activity" : t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- Observation type → color / label ----
export const OBS_META: Record<ObservationType, { color: string; label: string }> = {
  excavation_signature: { color: "#f43f5e", label: "Excavation Signature" },
  surface_disturbance: { color: "#fb7185", label: "Surface Disturbance" },
  new_waterbody: { color: "#f59e0b", label: "New Water Body" },
  water_discoloration: { color: "#fb923c", label: "Water Discoloration" },
  vegetation_loss: { color: "#f97316", label: "Vegetation Loss" },
  deforestation: { color: "#ef4444", label: "Deforestation" },
  new_road: { color: "#2dd4bf", label: "New Road" },
  construction: { color: "#fbbf24", label: "Construction" },
  settlement_growth: { color: "#eab308", label: "Settlement Growth" },
  shoreline_change: { color: "#14b8a6", label: "Shoreline Change" },
  river_morphology: { color: "#06b6d4", label: "River Morphology" },
  land_cover_change: { color: "#84cc16", label: "Land Cover Change" },
};

export function obsColor(t: ObservationType): string {
  return OBS_META[t]?.color ?? "#a1a1aa";
}

export const SEVERITY_META = {
  critical: { color: "#f43f5e", label: "Critical" },
  high: { color: "#fb923c", label: "High" },
  moderate: { color: "#fbbf24", label: "Moderate" },
  low: { color: "#34d399", label: "Low" },
} as const;

export const STATUS_META: Record<ObservationStatus, { color: string; label: string }> = {
  active: { color: "#f43f5e", label: "Active" },
  monitoring: { color: "#fbbf24", label: "Monitoring" },
  review: { color: "#a78bfa", label: "In Review" },
  resolved: { color: "#34d399", label: "Resolved" },
};

export const SOURCE_STATUS_META = {
  healthy: { color: "#34d399", label: "Healthy" },
  syncing: { color: "#fbbf24", label: "Syncing" },
  degraded: { color: "#fb923c", label: "Degraded" },
  offline: { color: "#f43f5e", label: "Offline" },
} as const;

export function confidenceLabel(c: number): string {
  if (c >= 0.9) return "High";
  if (c >= 0.75) return "Moderate";
  return "Low";
}

export function confidenceColor(c: number): string {
  if (c >= 0.9) return "#34d399";
  if (c >= 0.75) return "#fbbf24";
  return "#fb923c";
}
