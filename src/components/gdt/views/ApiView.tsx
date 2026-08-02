"use client";

import { useMemo, useState } from "react";
import { SectionLabel } from "@/components/gdt/atoms";
import { Button } from "@/components/ui/button";
import { ENTITIES } from "@/lib/gdt/entities";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { DATA_SOURCES } from "@/lib/gdt/sources";
import { GRAPH_NODES, GRAPH_EDGES } from "@/lib/gdt/graph";
import { cn } from "@/lib/utils";
import { Check, Copy, Play, Search } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// API reference configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.gdt.gh/v1";

type HttpMethod = "GET" | "POST";

interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

interface ResponseField {
  field: string;
  type: string;
}

interface Endpoint {
  id: string;
  group: string;
  method: HttpMethod;
  path: string;
  label: string;
  description: string;
  params: EndpointParam[];
  responseSchema: ResponseField[];
  body?: string;
  sample: () => unknown;
}

const GROUPS = [
  "Spatial Queries",
  "Temporal Queries",
  "Observations",
  "Entities",
  "Knowledge Graph",
  "Raster",
  "Metadata",
] as const;

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#34d399", // emerald
  POST: "#fbbf24", // gold
};

// Real domain samples — pulled from the live twin registry so the JSON
// response examples mirror what the API actually returns.
const sampleEntity =
  ENTITIES.find((e) => e.id === "ent-ankobra-river") ?? ENTITIES[0];
const sampleObservation =
  OBSERVATIONS.find((o) => o.id === "obs-2841") ?? OBSERVATIONS[0];
const sampleSource =
  DATA_SOURCES.find((s) => s.id === "src-s2") ?? DATA_SOURCES[0];

const ENDPOINTS: Endpoint[] = [
  // ── Spatial Queries ──────────────────────────────────────────────────────
  {
    id: "spatial-entities",
    group: "Spatial Queries",
    method: "GET",
    path: "/v1/entities",
    label: "Search entities by bbox",
    description:
      "Returns a paginated list of twin entities intersecting the supplied bounding box. Filter by kind to narrow to a feature class. The twin returns observed physical-world features only — no legal interpretation is attached to any record.",
    params: [
      { name: "bbox", type: "string", required: true, desc: "West,South,East,North in degrees (WGS84)" },
      { name: "kind", type: "string", required: false, desc: "Entity kind filter (river, forest, excavation…)" },
      { name: "limit", type: "integer", required: false, desc: "Page size (max 200, default 50)" },
      { name: "cursor", type: "string", required: false, desc: "Opaque pagination cursor from a previous page" },
    ],
    responseSchema: [
      { field: "data", type: "TwinEntity[]" },
      { field: "data[].id", type: "string" },
      { field: "data[].kind", type: "EntityKind" },
      { field: "data[].centroid", type: "[lng, lat]" },
      { field: "data[].confidence", type: "number (0..1)" },
      { field: "pagination.next", type: "string | null" },
    ],
    sample: () => ({
      data: [sampleEntity],
      pagination: {
        next: "eyJjdXJzb3IiOiJlbnQtcHJhLXJpdmVyIn0",
        limit: 50,
        returned: 1,
      },
    }),
  },
  {
    id: "spatial-regions",
    group: "Spatial Queries",
    method: "GET",
    path: "/v1/regions/:id",
    label: "Administrative region",
    description:
      "Returns the geometry, bounding box and summary statistics for an administrative region (region or district). Geometry is returned in WGS84.",
    params: [
      { name: "id", type: "string", required: true, desc: "Region identifier (e.g. 'wst', 'vol')" },
      { name: "geometry", type: "boolean", required: false, desc: "Include full polygon geometry (default true)" },
    ],
    responseSchema: [
      { field: "id", type: "string" },
      { field: "name", type: "string" },
      { field: "bbox", type: "[w, s, e, n]" },
      { field: "areaKm2", type: "number" },
      { field: "centroid", type: "[lng, lat]" },
      { field: "districtCount", type: "integer" },
    ],
    sample: () => ({
      id: "wst",
      name: "Western Region",
      bbox: [-3.0, 4.7, -1.6, 6.4],
      areaKm2: 13947,
      population: 2188000,
      centroid: [-2.18, 5.55],
      geometryType: "polygon",
      districtCount: 22,
    }),
  },
  {
    id: "spatial-snap",
    group: "Spatial Queries",
    method: "POST",
    path: "/v1/spatial/snap",
    label: "Snap point to nearest feature",
    description:
      "Snaps a coordinate to the nearest twin feature of the requested kind within a radius. Useful for attribution when an operator clicks the map. Snapping is purely geometric — no semantic inference is performed.",
    params: [
      { name: "body.lng", type: "number", required: true, desc: "Longitude (WGS84)" },
      { name: "body.lat", type: "number", required: true, desc: "Latitude (WGS84)" },
      { name: "body.kind", type: "string", required: true, desc: "Target feature kind" },
      { name: "body.radiusM", type: "integer", required: false, desc: "Snap tolerance in metres (default 500)" },
    ],
    body: JSON.stringify(
      { lng: -2.143, lat: 5.428, kind: "river", radiusM: 500 },
      null,
      2,
    ),
    responseSchema: [
      { field: "snapped", type: "boolean" },
      { field: "entity", type: "TwinEntity" },
      { field: "distanceM", type: "number" },
    ],
    sample: () => ({
      snapped: true,
      entity: sampleEntity,
      distanceM: 137,
    }),
  },

  // ── Temporal Queries ─────────────────────────────────────────────────────
  {
    id: "temporal-state",
    group: "Temporal Queries",
    method: "GET",
    path: "/v1/temporal/state",
    label: "Twin state at timestamp",
    description:
      "Returns the bitemporal state of the twin at the supplied 'as-of' timestamp. Useful for replaying conditions at the time of a prior event. No retroactive inference is applied beyond what was committed at that time.",
    params: [
      { name: "at", type: "string (ISO 8601)", required: true, desc: "Historical timestamp (e.g. 2024-06-01T00:00:00Z)" },
      { name: "bbox", type: "string", required: false, desc: "Optional bounding box filter" },
      { name: "kind", type: "string", required: false, desc: "Optional entity kind filter" },
    ],
    responseSchema: [
      { field: "at", type: "string (ISO 8601)" },
      { field: "entityCount", type: "integer" },
      { field: "observationCount", type: "integer" },
      { field: "activeAlerts", type: "integer" },
      { field: "twinVersion", type: "string" },
    ],
    sample: () => ({
      at: "2024-06-01T00:00:00Z",
      entityCount: 18742,
      observationCount: 968,
      activeAlerts: 14,
      twinVersion: "2024.06.01-r3",
      temporalMode: "historical",
    }),
  },
  {
    id: "temporal-diff",
    group: "Temporal Queries",
    method: "GET",
    path: "/v1/temporal/diff",
    label: "Compute change between dates",
    description:
      "Returns the set of entities and observations that changed between two timestamps. The twin reports observed change only — the operator decides significance. No legal attribution is implied.",
    params: [
      { name: "from", type: "string (ISO 8601)", required: true, desc: "Start timestamp (exclusive)" },
      { name: "to", type: "string (ISO 8601)", required: true, desc: "End timestamp (inclusive)" },
      { name: "bbox", type: "string", required: false, desc: "Optional bounding box filter" },
      { name: "kind", type: "string", required: false, desc: "Optional entity kind filter" },
    ],
    responseSchema: [
      { field: "from", type: "string (ISO 8601)" },
      { field: "to", type: "string (ISO 8601)" },
      { field: "entityChanges", type: "integer" },
      { field: "newObservations", type: "Observation[]" },
      { field: "summary", type: "Record<ObservationType, integer>" },
    ],
    sample: () => ({
      from: "2024-05-01T00:00:00Z",
      to: "2024-06-01T00:00:00Z",
      entityChanges: 412,
      newObservations: [sampleObservation],
      summary: { vegetation_loss: 6, water_discoloration: 3, excavation_signature: 2 },
    }),
  },

  // ── Observations ─────────────────────────────────────────────────────────
  {
    id: "obs-list",
    group: "Observations",
    method: "GET",
    path: "/v1/observations",
    label: "List observations",
    description:
      "Returns change-detection observations filtered by type, status and bounding box. Observations are objective evidence of a physical-world change; the twin does not assert attribution or legality. Each record carries its own evidence chain and confidence.",
    params: [
      { name: "type", type: "string", required: false, desc: "Comma-separated observation types" },
      { name: "status", type: "string", required: false, desc: "active|monitoring|resolved|review" },
      { name: "bbox", type: "string", required: false, desc: "West,South,East,North bounding box" },
      { name: "since", type: "string (ISO 8601)", required: false, desc: "Only observations after this timestamp" },
      { name: "limit", type: "integer", required: false, desc: "Page size (default 50)" },
    ],
    responseSchema: [
      { field: "data", type: "Observation[]" },
      { field: "data[].id", type: "string" },
      { field: "data[].type", type: "ObservationType" },
      { field: "data[].severity", type: "low|moderate|high|critical" },
      { field: "data[].confidence", type: "number (0..1)" },
      { field: "count", type: "integer" },
    ],
    sample: () => ({ data: [sampleObservation], count: 1, total: 412 }),
  },
  {
    id: "obs-detail",
    group: "Observations",
    method: "GET",
    path: "/v1/observations/:id",
    label: "Observation detail",
    description:
      "Returns the full observation record including evidence chain, supporting datasets and the model reasoning trace. Reasoning is provided for transparency — it is not a legal conclusion and must not be cited as such.",
    params: [
      { name: "id", type: "string", required: true, desc: "Observation identifier (e.g. obs-2841)" },
      { name: "include_evidence", type: "boolean", required: false, desc: "Include per-dataset evidence records (default true)" },
    ],
    responseSchema: [
      { field: "id", type: "string" },
      { field: "type", type: "ObservationType" },
      { field: "title", type: "string" },
      { field: "summary", type: "string" },
      { field: "evidence", type: "ObservationEvidence[]" },
      { field: "reasoning", type: "string" },
    ],
    sample: () => sampleObservation,
  },
  {
    id: "obs-query",
    group: "Observations",
    method: "POST",
    path: "/v1/observations/query",
    label: "Advanced observation query",
    description:
      "Submits a structured query payload combining spatial, temporal and attribute filters. Supports sort, projection and pagination in a single round-trip. Returns only what was observed — the twin makes no legal determinations.",
    params: [
      { name: "body.filter", type: "object", required: true, desc: "Filter spec: types[], statuses[], bbox, since/until, minConfidence" },
      { name: "body.sort", type: "object[]", required: false, desc: "Sort clauses, e.g. [{field: 'timestamp', dir: 'desc'}]" },
      { name: "body.projection", type: "string[]", required: false, desc: "Fields to include in response" },
      { name: "body.limit", type: "integer", required: false, desc: "Page size (default 50, max 200)" },
    ],
    body: JSON.stringify(
      {
        filter: {
          types: ["excavation_signature", "water_discoloration"],
          statuses: ["active", "monitoring"],
          bbox: [-3.0, 4.7, -1.6, 6.4],
          minConfidence: 0.75,
        },
        sort: [{ field: "severity", dir: "desc" }],
        projection: ["id", "type", "title", "confidence", "severity", "location"],
        limit: 25,
      },
      null,
      2,
    ),
    responseSchema: [
      { field: "data", type: "Observation[]" },
      { field: "count", type: "integer" },
      { field: "total", type: "integer" },
      { field: "elapsed_ms", type: "integer" },
    ],
    sample: () => ({
      data: [sampleObservation],
      count: 1,
      total: 14,
      elapsed_ms: 38,
    }),
  },

  // ── Entities ─────────────────────────────────────────────────────────────
  {
    id: "entity-detail",
    group: "Entities",
    method: "GET",
    path: "/v1/entities/:id",
    label: "Entity by id",
    description:
      "Returns the full twin entity record, including geometry, attribute bag, version history and tags. Versions are append-only — historical entries are never mutated, only superseded.",
    params: [
      { name: "id", type: "string", required: true, desc: "Entity identifier (e.g. ent-ankobra-river)" },
      { name: "geometry", type: "boolean", required: false, desc: "Include full geometry (default true)" },
    ],
    responseSchema: [
      { field: "id", type: "string" },
      { field: "kind", type: "EntityKind" },
      { field: "centroid", type: "[lng, lat]" },
      { field: "geometry", type: "LngLat[]" },
      { field: "attributes", type: "Record<string, string|number>" },
      { field: "versions", type: "EntityVersion[]" },
    ],
    sample: () => sampleEntity,
  },
  {
    id: "entity-versions",
    group: "Entities",
    method: "GET",
    path: "/v1/entities/:id/versions",
    label: "Entity version history",
    description:
      "Returns the append-only version history of an entity. Each entry is an immutable change record with source attribution and confidence. Useful for audit and lineage tracing.",
    params: [
      { name: "id", type: "string", required: true, desc: "Entity identifier" },
      { name: "since", type: "string (ISO 8601)", required: false, desc: "Filter versions after this timestamp" },
    ],
    responseSchema: [
      { field: "id", type: "string" },
      { field: "current", type: "integer" },
      { field: "versions", type: "EntityVersion[]" },
      { field: "versions[].version", type: "integer" },
      { field: "versions[].source", type: "string" },
      { field: "versions[].confidence", type: "number (0..1)" },
    ],
    sample: () => ({
      id: sampleEntity.id,
      current: sampleEntity.version,
      versions: sampleEntity.versions,
    }),
  },
  {
    id: "entity-neighbors",
    group: "Entities",
    method: "GET",
    path: "/v1/entities/:id/neighbors",
    label: "Adjacent entities",
    description:
      "Returns entities topologically adjacent to the target (e.g. tributaries, neighbouring catchments). Useful for impact propagation without invoking full graph traversal.",
    params: [
      { name: "id", type: "string", required: true, desc: "Entity identifier" },
      { name: "relation", type: "string", required: false, desc: "Relation filter (e.g. tributary_of, adjacent_to)" },
      { name: "limit", type: "integer", required: false, desc: "Max results (default 20)" },
    ],
    responseSchema: [
      { field: "id", type: "string" },
      { field: "neighbors", type: "object[]" },
      { field: "neighbors[].entity", type: "string" },
      { field: "neighbors[].relation", type: "string" },
    ],
    sample: () => ({
      id: sampleEntity.id,
      neighbors: GRAPH_EDGES.filter(
        (e) => e.source === sampleEntity.id || e.target === sampleEntity.id,
      )
        .slice(0, 4)
        .map((e) => ({
          entity: e.source === sampleEntity.id ? e.target : e.source,
          relation: e.relation,
        })),
    }),
  },

  // ── Knowledge Graph ──────────────────────────────────────────────────────
  {
    id: "graph-nb",
    group: "Knowledge Graph",
    method: "GET",
    path: "/v1/graph/:entityId",
    label: "Graph neighborhood",
    description:
      "Returns the k-hop neighborhood of an entity in the geospatial knowledge graph. Edges are typed relations (affects, observes, tributary_of…). The graph is read-only and recomputed nightly from the latest committed twin state.",
    params: [
      { name: "entityId", type: "string", required: true, desc: "Seed entity identifier" },
      { name: "depth", type: "integer", required: false, desc: "Hop depth (default 2, max 4)" },
      { name: "relation", type: "string", required: false, desc: "Relation filter" },
    ],
    responseSchema: [
      { field: "root", type: "string" },
      { field: "depth", type: "integer" },
      { field: "nodes", type: "GraphNode[]" },
      { field: "edges", type: "GraphEdge[]" },
    ],
    sample: () => {
      const seeds = [sampleEntity.id, "ent-prestea-galamsey", "obs-2841"];
      return {
        root: sampleEntity.id,
        depth: 2,
        nodes: GRAPH_NODES.filter((n) => seeds.includes(n.id)),
        edges: GRAPH_EDGES.filter(
          (e) => seeds.includes(e.source) && seeds.includes(e.target),
        ),
      };
    },
  },
  {
    id: "graph-paths",
    group: "Knowledge Graph",
    method: "GET",
    path: "/v1/graph/paths",
    label: "Find graph paths",
    description:
      "Finds typed paths between two entities in the knowledge graph. Returns up to N shortest paths with their edge relations. Useful for impact-trace explanations — paths describe topology, not causation.",
    params: [
      { name: "from", type: "string", required: true, desc: "Source entity id" },
      { name: "to", type: "string", required: true, desc: "Target entity id" },
      { name: "maxPaths", type: "integer", required: false, desc: "Max paths to return (default 3)" },
      { name: "maxDepth", type: "integer", required: false, desc: "Max path length (default 5)" },
    ],
    responseSchema: [
      { field: "from", type: "string" },
      { field: "to", type: "string" },
      { field: "paths", type: "object[]" },
      { field: "paths[].hops", type: "string[]" },
      { field: "paths[].relations", type: "string[]" },
    ],
    sample: () => ({
      from: "ent-prestea-galamsey",
      to: "ent-coastline",
      paths: [
        {
          hops: ["ent-prestea-galamsey", "ent-ankobra-river", "ent-coastline"],
          relations: ["affects", "flows_to"],
        },
      ],
    }),
  },

  // ── Raster ───────────────────────────────────────────────────────────────
  {
    id: "raster-tile",
    group: "Raster",
    method: "GET",
    path: "/v1/raster/tile/:z/:x/:y",
    label: "Raster tile",
    description:
      "Returns a WebMercator raster tile from the requested dataset as a PNG byte stream. Use the bands parameter to select spectral bands for composite rendering. The twin caches tiles for 24 hours; source scenes remain authoritative.",
    params: [
      { name: "z", type: "integer", required: true, desc: "Zoom level (0–14)" },
      { name: "x", type: "integer", required: true, desc: "Tile column" },
      { name: "y", type: "integer", required: true, desc: "Tile row" },
      { name: "dataset", type: "string", required: true, desc: "Dataset id (sentinel-2, sentinel-1, landsat-8)" },
      { name: "bands", type: "string", required: false, desc: "Comma-separated band ids (default B4,B3,B2)" },
    ],
    responseSchema: [
      { field: "dataset", type: "string" },
      { field: "z", type: "integer" },
      { field: "bands", type: "string[]" },
      { field: "contentType", type: "string" },
      { field: "bytes", type: "integer" },
      { field: "sceneDate", type: "string (ISO 8601)" },
    ],
    sample: () => ({
      dataset: "sentinel-2",
      z: 11,
      x: 1142,
      y: 998,
      bands: ["B4", "B3", "B2"],
      contentType: "image/png",
      bytes: 18432,
      sceneDate: "2025-01-18T03:42:00Z",
      cacheHit: true,
      url: `${BASE_URL}/raster/tile/11/1142/998?dataset=sentinel-2&bands=B4,B3,B2`,
    }),
  },
  {
    id: "raster-scene",
    group: "Raster",
    method: "GET",
    path: "/v1/raster/scene/:dataset/:date",
    label: "Scene metadata",
    description:
      "Returns scene-level metadata (cloud cover, acquisition time, footprint, processing baseline) for a dataset on a given date. Use this to verify scene availability before requesting tiles.",
    params: [
      { name: "dataset", type: "string", required: true, desc: "Dataset id" },
      { name: "date", type: "string (YYYY-MM-DD)", required: true, desc: "Acquisition date" },
      { name: "bbox", type: "string", required: false, desc: "Bounding box filter for multi-tile scenes" },
    ],
    responseSchema: [
      { field: "dataset", type: "string" },
      { field: "sceneId", type: "string" },
      { field: "cloudCover", type: "number (%)" },
      { field: "acquisitionTime", type: "string (ISO 8601)" },
      { field: "tiles", type: "integer" },
    ],
    sample: () => ({
      dataset: "sentinel-2",
      date: "2025-01-18",
      sceneId: "S2A_MSIL2A_20250118T034200_N0509_R135_T30NYP",
      cloudCover: 12.4,
      acquisitionTime: "2025-01-18T03:42:00Z",
      processingBaseline: "05.09",
      footprint: [-3.0, 4.7, -1.6, 6.4],
      tiles: 24,
    }),
  },
  {
    id: "raster-indices",
    group: "Raster",
    method: "POST",
    path: "/v1/raster/indices",
    label: "Compute spectral index",
    description:
      "Computes a spectral index (NDVI, NDWI, NBR, turbidity) over a bbox for a date range. Returns zonal statistics and a histogram. Index values are derived from radiometry — interpretation is the caller's responsibility.",
    params: [
      { name: "body.index", type: "string", required: true, desc: "Index id (ndvi, ndwi, nbr, turbidity)" },
      { name: "body.bbox", type: "string", required: true, desc: "Bounding box for computation" },
      { name: "body.from", type: "string (ISO 8601)", required: true, desc: "Start date" },
      { name: "body.to", type: "string (ISO 8601)", required: true, desc: "End date" },
    ],
    body: JSON.stringify(
      {
        index: "ndvi",
        bbox: "-2.3,5.3,-2.0,5.6",
        from: "2024-12-01T00:00:00Z",
        to: "2025-01-18T00:00:00Z",
      },
      null,
      2,
    ),
    responseSchema: [
      { field: "index", type: "string" },
      { field: "mean", type: "number" },
      { field: "min", type: "number" },
      { field: "max", type: "number" },
      { field: "histogram", type: "object[]" },
      { field: "histogram[].bin", type: "string" },
      { field: "histogram[].count", type: "integer" },
    ],
    sample: () => ({
      index: "ndvi",
      bbox: [-2.3, 5.3, -2.0, 5.6],
      samples: 4,
      mean: 0.42,
      min: 0.08,
      max: 0.71,
      std: 0.16,
      histogram: [
        { bin: "[0.0,0.2)", count: 4120 },
        { bin: "[0.2,0.4)", count: 8810 },
        { bin: "[0.4,0.6)", count: 6240 },
        { bin: "[0.6,0.8)", count: 1980 },
      ],
    }),
  },

  // ── Metadata ─────────────────────────────────────────────────────────────
  {
    id: "meta-sources",
    group: "Metadata",
    method: "GET",
    path: "/v1/sources",
    label: "List data sources",
    description:
      "Returns the catalogue of registered data sources with status, freshness and coverage. Use this to plan ingestion windows or attribute observations to upstream datasets.",
    params: [
      { name: "category", type: "string", required: false, desc: "Filter by source category" },
      { name: "status", type: "string", required: false, desc: "Filter by status (healthy|syncing|degraded|offline)" },
    ],
    responseSchema: [
      { field: "data", type: "DataSource[]" },
      { field: "data[].id", type: "string" },
      { field: "data[].category", type: "SourceCategory" },
      { field: "data[].status", type: "SourceStatus" },
      { field: "data[].freshnessMin", type: "integer" },
    ],
    sample: () => ({
      data: DATA_SOURCES.slice(0, 3),
      count: DATA_SOURCES.length,
    }),
  },
  {
    id: "meta-source-detail",
    group: "Metadata",
    method: "GET",
    path: "/v1/sources/:id",
    label: "Source detail",
    description:
      "Returns a single data source record including storage footprint, license and connector latency metrics.",
    params: [
      { name: "id", type: "string", required: true, desc: "Source identifier (e.g. src-s2)" },
    ],
    responseSchema: [
      { field: "id", type: "string" },
      { field: "provider", type: "string" },
      { field: "resolution", type: "string" },
      { field: "cadence", type: "string" },
      { field: "records", type: "integer" },
      { field: "storageTB", type: "number" },
    ],
    sample: () => sampleSource,
  },
  {
    id: "meta-health",
    group: "Metadata",
    method: "GET",
    path: "/v1/health",
    label: "Service health",
    description:
      "Returns service health, dependency status and ingestion throughput. Suitable for uptime probes. The twin reports infrastructure health only — observation-level confidence is exposed on each observation record.",
    params: [
      { name: "verbose", type: "boolean", required: false, desc: "Include per-dependency latency (default false)" },
    ],
    responseSchema: [
      { field: "status", type: "ok|degraded|down" },
      { field: "version", type: "string" },
      { field: "uptimeS", type: "integer" },
      { field: "dependencies", type: "object[]" },
      { field: "ingestion", type: "object" },
    ],
    sample: () => ({
      status: "ok",
      version: "2025.01.18-r3",
      uptimeS: 924360,
      dependencies: [
        { name: "postgres", status: "ok", latencyMs: 4 },
        { name: "tile-cache", status: "ok", latencyMs: 12 },
        { name: "graph-store", status: "degraded", latencyMs: 88 },
      ],
      ingestion: { last5m: 18432, pending: 0 },
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pathArgExample(name: string): string {
  switch (name) {
    case "id":
      return "ent-ankobra-river";
    case "entityId":
      return "ent-ankobra-river";
    case "z":
      return "11";
    case "x":
      return "1142";
    case "y":
      return "998";
    case "dataset":
      return "sentinel-2";
    case "date":
      return "2025-01-18";
    default:
      return "1";
  }
}

function paramExample(name: string): string {
  switch (name) {
    case "bbox":
      return "-3.0,4.7,-1.6,6.4";
    case "kind":
      return "river";
    case "at":
      return "2024-06-01T00:00:00Z";
    case "from":
      return "2024-05-01T00:00:00Z";
    case "to":
      return "2024-06-01T00:00:00Z";
    case "type":
      return "excavation_signature";
    case "status":
      return "active";
    case "since":
      return "2025-01-01T00:00:00Z";
    case "depth":
      return "2";
    case "maxPaths":
      return "3";
    case "maxDepth":
      return "5";
    case "limit":
      return "50";
    case "bands":
      return "B4,B3,B2";
    case "category":
      return "optical";
    case "verbose":
      return "true";
    case "geometry":
      return "true";
    case "relation":
      return "tributary_of";
    case "include_evidence":
      return "true";
    case "cursor":
      return "";
    default:
      return "1";
  }
}

function buildCurl(ep: Endpoint): string {
  const url = `${BASE_URL}${ep.path.replace(
    /:[a-zA-Z]+/g,
    (m) => pathArgExample(m.slice(1)),
  )}`;

  if (ep.method === "POST" && ep.body) {
    return [
      `curl -X POST '${url}' \\`,
      `  -H 'Authorization: Bearer $GDT_API_KEY' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${ep.body.replace(/\s+/g, " ")}'`,
    ].join("\n");
  }

  const queryParams = ep.params
    .filter((p) => !p.name.includes(".") && p.required)
    .slice(0, 3)
    .map((p) => `${p.name}=${encodeURIComponent(paramExample(p.name))}`)
    .join("&");
  const qs = queryParams ? `?${queryParams}` : "";

  return [
    `curl '${url}${qs}' \\`,
    `  -H 'Authorization: Bearer $GDT_API_KEY' \\`,
    `  -H 'Accept: application/json'`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MethodBadge({
  method,
  size = "sm",
}: {
  method: HttpMethod;
  size?: "sm" | "lg";
}) {
  const color = METHOD_COLORS[method];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-mono font-bold rounded shrink-0",
        size === "lg"
          ? "px-2 py-1 text-[15px] min-w-[54px]"
          : "px-1.5 py-0.5 text-[14px] min-w-[40px]",
      )}
      style={{
        color,
        background: `${color}1a`,
        border: `1px solid ${color}33`,
      }}
    >
      {method}
    </span>
  );
}

function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {
            /* clipboard unavailable */
          });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card/40 hover:bg-foreground/5 transition-colors",
        className,
      )}
      aria-label={label ? `Copy ${label}` : "Copy to clipboard"}
    >
      {label && (
        <span className="text-[15px] font-mono text-muted-foreground">
          {label}
        </span>
      )}
      {copied ? (
        <Check className="size-3" style={{ color: METHOD_COLORS.GET }} />
      ) : (
        <Copy className="size-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────

export function ApiView() {
  const [selected, setSelected] = useState<string>(ENDPOINTS[0].id);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENDPOINTS;
    return ENDPOINTS.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.label.toLowerCase().includes(q) ||
        ep.group.toLowerCase().includes(q),
    );
  }, [query]);

  const ep = useMemo(
    () => ENDPOINTS.find((e) => e.id === selected) ?? ENDPOINTS[0],
    [selected],
  );

  const responseJson = useMemo(
    () => JSON.stringify(ep.sample(), null, 2),
    [ep],
  );

  const curl = useMemo(() => buildCurl(ep), [ep]);

  return (
    <div className="h-full w-full flex flex-col lg:flex-row bg-background">
      {/* ── LEFT: endpoint navigator ─────────────────────────────────────── */}
      <aside className="w-full lg:w-[300px] lg:border-r border-border lg:h-full max-h-[38vh] lg:max-h-none overflow-y-auto gdt-scroll p-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Endpoints</SectionLabel>
          <span className="text-[14px] font-mono text-muted-foreground tabular-nums">
            {ENDPOINTS.length}
          </span>
        </div>

        {/* search */}
        <div className="relative mb-4">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter endpoints…"
            className="w-full pl-7 pr-2 py-1.5 text-[15px] rounded-md bg-foreground/5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
            aria-label="Filter endpoints"
          />
        </div>

        {/* groups */}
        <nav className="space-y-3">
          {GROUPS.map((g) => {
            const items = filtered.filter((e) => e.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <div className="px-2 mb-1 text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {g}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.id === selected;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelected(item.id)}
                        className={cn(
                          "w-full text-left flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-md border-l-2 border-transparent hover:bg-foreground/5 transition-colors",
                          active && "bg-primary/10 border-primary",
                        )}
                      >
                        <MethodBadge method={item.method} />
                        <span className="flex-1 min-w-0">
                          <span className="block font-mono text-[15px] truncate text-foreground/90">
                            {item.path}
                          </span>
                          <span className="block text-[14px] text-muted-foreground truncate">
                            {item.label}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-2 py-4 text-[15px] text-muted-foreground italic">
              No endpoints match &quot;{query}&quot;.
            </div>
          )}
        </nav>
      </aside>

      {/* ── RIGHT: endpoint detail ───────────────────────────────────────── */}
      <main className="flex-1 min-h-0 lg:h-full overflow-y-auto gdt-scroll p-5">
        {/* top bar: base URL */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <SectionLabel>API Reference</SectionLabel>
          <div className="flex items-center gap-2">
            <span className="text-[14px] uppercase tracking-wider text-muted-foreground/70">
              Base URL
            </span>
            <CopyButton value={BASE_URL} label={BASE_URL} />
          </div>
        </div>

        {/* endpoint header */}
        <div className="flex items-start gap-3 mb-3">
          <MethodBadge method={ep.method} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm sm:text-base break-all text-foreground">
              {ep.path}
            </div>
            <div className="text-[15px] text-muted-foreground mt-0.5">
              {ep.label}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              navigator.clipboard
                .writeText(curl)
                .then(() => {})
                .catch(() => {});
            }}
          >
            <Play className="size-3.5" />
            Try it
          </Button>
        </div>

        {/* description */}
        <p className="text-[16px] leading-relaxed text-muted-foreground mb-6 max-w-3xl">
          {ep.description}
        </p>

        {/* parameters */}
        <section className="mb-6">
          <SectionLabel className="mb-2">Parameters</SectionLabel>
          {ep.params.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/40 px-3 py-2 text-[15px] italic text-muted-foreground">
              No parameters.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto gdt-scroll">
                <table className="w-full min-w-[560px] text-[15px] border-collapse">
                  <thead>
                    <tr className="bg-foreground/5 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground text-left">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Required</th>
                      <th className="px-3 py-2 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.params.map((p, i) => (
                      <tr
                        key={p.name}
                        className={cn(
                          "border-t border-border/50",
                          i % 2 === 1 && "bg-foreground/[0.02]",
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-foreground/90 align-top">
                          {p.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground align-top">
                          {p.type}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {p.required ? (
                            <span
                              className="text-[14px] font-semibold"
                              style={{ color: METHOD_COLORS.POST }}
                            >
                              required
                            </span>
                          ) : (
                            <span className="text-[14px] text-muted-foreground/60">
                              optional
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground align-top">
                          {p.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* example request */}
        <section className="mb-6">
          <SectionLabel className="mb-2">Example Request</SectionLabel>
          <pre className="rounded-lg border border-border bg-background/60 p-3 text-[15px] font-mono overflow-x-auto gdt-scroll leading-relaxed">
            {curl}
          </pre>
        </section>

        {/* example response */}
        <section className="mb-6">
          <SectionLabel className="mb-2">Example Response</SectionLabel>
          <pre className="rounded-lg border border-border bg-background/60 p-3 text-[15px] font-mono overflow-x-auto gdt-scroll leading-relaxed">
            {responseJson}
          </pre>
        </section>

        {/* response schema */}
        <section className="mb-6">
          <SectionLabel className="mb-2">Response Schema</SectionLabel>
          <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/50 overflow-hidden">
            {ep.responseSchema.map((f) => (
              <div
                key={f.field}
                className="grid grid-cols-[minmax(140px,1.3fr)_1.7fr] gap-2 px-3 py-1.5 text-[15px] font-mono"
              >
                <div className="text-foreground/90 truncate">{f.field}</div>
                <div className="text-muted-foreground truncate">{f.type}</div>
              </div>
            ))}
          </div>
        </section>

        {/* footer note */}
        <div className="mt-8 pt-4 border-t border-border/50 text-[14px] text-muted-foreground/60 max-w-3xl leading-relaxed">
          The Ghana Digital Twin API exposes observed geospatial primitives
          only. Responses describe physical-world state and change; they do
          not constitute legal findings, attribution, or enforcement
          recommendations. All records carry source attribution and
          confidence values for downstream audit.
        </div>
      </main>
    </div>
  );
}
