// Ghana Digital Twin — World Model domain types

export type EntityKind =
  | "river"
  | "lake"
  | "watershed"
  | "forest"
  | "protected_area"
  | "road"
  | "bridge"
  | "settlement"
  | "administrative_boundary"
  | "water_body"
  | "terrain_feature"
  | "land_cover_region"
  | "railway"
  | "dam";

export type EntityType =
  | "natural"
  | "infrastructure"
  | "administrative"
  | "human_activity";

export type GeometryType =
  | "Point"
  | "LineString"
  | "Polygon"
  | "MultiPolygon";

// Canonical kind/type mapping for OSM-derived features
export const KIND_TYPE: Record<EntityKind, EntityType> = {
  river: "natural",
  lake: "natural",
  watershed: "natural",
  forest: "natural",
  protected_area: "administrative",
  road: "infrastructure",
  railway: "infrastructure",
  bridge: "infrastructure",
  settlement: "infrastructure",
  dam: "infrastructure",
  administrative_boundary: "administrative",
  water_body: "natural",
  terrain_feature: "natural",
  land_cover_region: "natural",
};

export interface EntityRecord {
  id: string;
  uuid: string;
  externalId: string;
  kind: EntityKind;
  type: EntityType;
  name: string;
  regionId: string | null;
  geometryType: GeometryType;
  geometry: GeoJSON.Geometry;
  centroid: [number, number];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  areaKm2: number | null;
  lengthKm: number | null;
  attributes: Record<string, string | number | boolean>;
  tags: string[];
  confidence: number;
  datasetSourceId: string;
  sourceName: string;
  sourceVersion: string;
  firstObserved: string;
  lastObserved: string;
  currentVersion: number;
}

export interface RelationshipRecord {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relation: string;
  inferredBy: "spatial" | "source" | "manual";
  confidence: number;
  createdAt: string;
}

export interface EntityVersionRecord {
  id: string;
  entityId: string;
  version: number;
  change: string;
  geometry: GeoJSON.Geometry;
  attributes: Record<string, string | number | boolean>;
  confidence: number;
  sourceName: string;
  sourceVersion: string;
  observedAt: string;
}

// Pipeline event types
export type PipelineEventType =
  | "DatasetDownloaded"
  | "DatasetValidated"
  | "DatasetNormalized"
  | "DatasetTransformed"
  | "DatasetUpdated"
  | "EntityCreated"
  | "EntityUpdated"
  | "EntityVersionCreated"
  | "RelationshipsUpdated"
  | "ConnectorFailed"
  | "ConnectorRecovered"
  | "ConnectorStarted"
  | "ConnectorCompleted"
  | "IndexRebuilt";

export interface PipelineEvent {
  type: PipelineEventType;
  sourceId?: string;
  entityId?: string;
  message: string;
  level: "info" | "warn" | "error";
  payload?: Record<string, unknown>;
  timestamp: string;
}

// Connector health
export type ConnectorStatus =
  | "pending"
  | "healthy"
  | "syncing"
  | "degraded"
  | "offline";

export type SourceCategory =
  | "administrative"
  | "hydrology"
  | "dem"
  | "landcover"
  | "weather"
  | "infrastructure"
  | "environmental"
  | "population"
  | "forest"
  | "settlement";

export interface DatasetSourceRecord {
  sourceId: string;
  name: string;
  category: SourceCategory;
  provider: string;
  license: string;
  resolution: string;
  cadence: string;
  coverage: string;
  description: string;
  storageType: "vector" | "raster" | "metadata";
  status: ConnectorStatus;
  recordCount: number;
  version?: string;
  lastSyncAt?: string;
  lastSuccessAt?: string;
  metadata: Record<string, unknown>;
}
