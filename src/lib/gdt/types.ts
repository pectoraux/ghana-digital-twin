// Ghana Digital Twin — Domain Types

import type { LngLat } from "./geo";

export type ViewId = "atlas" | "observations" | "phenomena" | "intelligence" | "missions" | "validation" | "extensions" | "continuous" | "groundtruth" | "multimodal" | "entities" | "graph" | "knowledge" | "eo" | "raster" | "sources" | "command" | "community" | "civic-trust" | "marketplace" | "finance" | "api";

export type EntityKind =
  | "river"
  | "lake"
  | "wetland"
  | "forest"
  | "vegetation"
  | "watershed"
  | "geology"
  | "elevation"
  | "coastline"
  | "road"
  | "railway"
  | "bridge"
  | "airport"
  | "port"
  | "dam"
  | "powerline"
  | "building"
  | "settlement"
  | "region"
  | "district"
  | "protected_area"
  | "agriculture"
  | "quarry"
  | "excavation"
  | "waterbody_mined";

export type EntityType = "natural" | "infrastructure" | "administrative" | "human_activity";

export interface EntityVersion {
  version: number;
  timestamp: string; // ISO
  change: string;
  source: string;
  confidence: number;
}

export interface TwinEntity {
  id: string;
  kind: EntityKind;
  type: EntityType;
  name: string;
  regionId: string;
  centroid: LngLat;
  geometry?: LngLat[]; // polyline or polygon
  geometryType?: "point" | "line" | "polygon";
  areaKm2?: number;
  lengthKm?: number;
  confidence: number; // 0..1
  source: string;
  firstObserved: string;
  lastUpdated: string;
  version: number;
  versions: EntityVersion[];
  attributes: Record<string, string | number>;
  tags: string[];
}

export type ObservationType =
  | "vegetation_loss"
  | "deforestation"
  | "surface_disturbance"
  | "excavation_signature"
  | "new_waterbody"
  | "water_discoloration"
  | "new_road"
  | "construction"
  | "settlement_growth"
  | "shoreline_change"
  | "river_morphology"
  | "land_cover_change";

export type ObservationStatus = "active" | "monitoring" | "resolved" | "review";

export interface ObservationEvidence {
  dataset: string;
  date: string;
  bands?: string;
  confidence: number;
}

export interface Observation {
  id: string;
  type: ObservationType;
  title: string;
  summary: string;
  location: LngLat;
  regionId: string;
  timestamp: string; // ISO
  detectedAt: string;
  affectedEntities: string[];
  supportingDatasets: string[];
  confidence: number; // 0..1
  status: ObservationStatus;
  severity: "low" | "moderate" | "high" | "critical";
  areaAffectedHa: number;
  modelVersion: string;
  pipeline: string;
  reasoning: string;
  attributes: Record<string, string | number>;
  evidence: ObservationEvidence[];
  beforeDate: string;
  afterDate: string;
}

export type SourceCategory =
  | "optical"
  | "sar"
  | "thermal"
  | "dem"
  | "hydrology"
  | "landcover"
  | "weather"
  | "infrastructure"
  | "administrative"
  | "environmental";

export type SourceStatus = "healthy" | "syncing" | "degraded" | "offline";

export interface DataSource {
  id: string;
  name: string;
  category: SourceCategory;
  provider: string;
  status: SourceStatus;
  resolution: string;
  cadence: string;
  lastSync: string;
  coverage: string;
  records: number;
  freshnessMin: number;
  latencyMs: number;
  storageTB: number;
  license: string;
  description: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: EntityKind | "observation";
  x: number;
  y: number;
  region?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface PipelineMetric {
  t: number;
  ingested: number;
  processed: number;
  observations: number;
}

export interface IngestionEvent {
  id: string;
  time: string;
  source: string;
  action: string;
  status: "ok" | "warn" | "err";
  detail: string;
}
