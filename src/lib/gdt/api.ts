"use client";

import { useEffect, useState, useCallback } from "react";
import type { EntityRecord, RelationshipRecord, EntityVersionRecord } from "@/lib/worldmodel/types";

// ---- Fetch helpers (server-relative) ----

export interface EntitiesResponse {
  entities: EntityRecord[];
  total: number;
  count: number;
  limit: number;
  offset: number;
}

export async function fetchEntities(params: {
  kind?: string;
  regionId?: string;
  bbox?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<EntitiesResponse> {
  const sp = new URLSearchParams();
  if (params.kind) sp.set("kind", params.kind);
  if (params.regionId) sp.set("regionId", params.regionId);
  if (params.bbox) sp.set("bbox", params.bbox);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  const res = await fetch(`/api/world-model/entities?${sp}`);
  if (!res.ok) throw new Error(`fetchEntities: ${res.status}`);
  return res.json();
}

export interface EntityDetailResponse {
  entity: EntityRecord;
  history: EntityVersionRecord[];
  relationships: RelationshipRecord[];
}

export async function fetchEntity(id: string): Promise<EntityDetailResponse> {
  const res = await fetch(`/api/world-model/entities/${id}`);
  if (!res.ok) throw new Error(`fetchEntity: ${res.status}`);
  return res.json();
}

export async function fetchEntityHistory(id: string): Promise<{ versions: EntityVersionRecord[]; count: number }> {
  const res = await fetch(`/api/world-model/entities/${id}/history`);
  if (!res.ok) throw new Error(`fetchEntityHistory: ${res.status}`);
  return res.json();
}

export interface GraphData {
  nodes: { id: string; label: string; kind: string; regionId: string | null; centroid: [number, number] }[];
  edges: { source: string; target: string; relation: string; inferredBy: string }[];
}

export async function fetchGraph(): Promise<GraphData> {
  const res = await fetch("/api/world-model/graph");
  if (!res.ok) throw new Error(`fetchGraph: ${res.status}`);
  return res.json();
}

export interface ConnectorInfo {
  sourceId: string;
  name: string;
  category: string;
  provider: string;
  license: string;
  resolution: string;
  cadence: string;
  coverage: string;
  description: string;
  storageType: string;
  status: string;
  recordCount: number;
  version: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  live: boolean;
  lastRun: {
    startedAt: string;
    finishedAt: string | null;
    status: string;
    recordsRead: number;
    recordsWritten: number;
    durationMs: number;
    error: string | null;
  } | null;
}

export async function fetchConnectors(): Promise<{ sources: ConnectorInfo[]; registeredConnectors: string[] }> {
  const res = await fetch("/api/connectors");
  if (!res.ok) throw new Error(`fetchConnectors: ${res.status}`);
  return res.json();
}

export async function triggerSync(sourceId: string): Promise<any> {
  const res = await fetch(`/api/connectors/${sourceId}`, { method: "POST" });
  return res.json();
}

export async function triggerSyncAll(): Promise<any> {
  const res = await fetch("/api/connectors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true }),
  });
  return res.json();
}

export interface HealthData {
  summary: {
    totalEntities: number;
    totalRelationships: number;
    totalVersions: number;
    totalSources: number;
    healthySources: number;
    degradedSources: number;
    syncingSources: number;
    liveSources: number;
  };
  entitiesByKind: { kind: string; count: number }[];
  sources: any[];
  recentRuns: any[];
  recentEvents: any[];
}

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`fetchHealth: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<any> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error(`fetchStats: ${res.status}`);
  return res.json();
}

export async function fetchChanges(since?: string, limit = 50): Promise<{ changes: any[]; count: number }> {
  const sp = new URLSearchParams();
  if (since) sp.set("since", since);
  sp.set("limit", String(limit));
  const res = await fetch(`/api/world-model/changes?${sp}`);
  if (!res.ok) throw new Error(`fetchChanges: ${res.status}`);
  return res.json();
}

export async function fetchNearest(lng: number, lat: number, maxKm = 50, kind?: string, limit = 10) {
  const sp = new URLSearchParams({ lng: String(lng), lat: String(lat), maxKm: String(maxKm), limit: String(limit) });
  if (kind) sp.set("kind", kind);
  const res = await fetch(`/api/world-model/spatial/nearest?${sp}`);
  if (!res.ok) throw new Error(`fetchNearest: ${res.status}`);
  return res.json();
}

// ===== Earth Observation API =====

export interface EOScene {
  id: string;
  stacId: string;
  collection: string;
  platform: string | null;
  datetime: string;
  cloudCover: number | null;
  mgrsTile: string | null;
  centroid: [number, number];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  geometry: GeoJSON.Geometry;
  gsd: number | null;
  bands: { name: string; href: string; commonName: string | null }[];
}

export interface EOIndex {
  name: string;
  formula: string;
  bands: string[];
  range: [number, number];
  description: string;
}

export async function fetchImagery(params: { bbox?: string; from?: string; to?: string; maxCloud?: number; limit?: number } = {}): Promise<{ scenes: EOScene[]; total: number; count: number }> {
  const sp = new URLSearchParams();
  if (params.bbox) sp.set("bbox", params.bbox);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.maxCloud != null) sp.set("maxCloud", String(params.maxCloud));
  if (params.limit) sp.set("limit", String(params.limit));
  const res = await fetch(`/api/eo/imagery?${sp}`);
  if (!res.ok) throw new Error(`fetchImagery: ${res.status}`);
  return res.json();
}

export async function fetchIndices(): Promise<{ indices: EOIndex[] }> {
  const res = await fetch("/api/eo/indices");
  if (!res.ok) throw new Error(`fetchIndices: ${res.status}`);
  return res.json();
}

export interface TimeSeriesPoint {
  sceneId: string;
  stacId: string;
  datetime: string;
  cloudCover: number | null;
  value: number | null;
}

export async function fetchTimeSeries(lng: number, lat: number, index: string, opts: { from?: string; to?: string; maxCloud?: number } = {}): Promise<{ points: TimeSeriesPoint[]; index: string; formula: string; description: string }> {
  const sp = new URLSearchParams({ lng: String(lng), lat: String(lat), index });
  if (opts.from) sp.set("from", opts.from);
  if (opts.to) sp.set("to", opts.to);
  if (opts.maxCloud != null) sp.set("maxCloud", String(opts.maxCloud));
  const res = await fetch(`/api/eo/timeseries?${sp}`);
  if (!res.ok) throw new Error(`fetchTimeSeries: ${res.status}`);
  return res.json();
}

export async function fetchPixel(lng: number, lat: number, index: string): Promise<{ pixels: any[]; index: string; formula: string; bands: string[] }> {
  const sp = new URLSearchParams({ lng: String(lng), lat: String(lat), index });
  const res = await fetch(`/api/eo/pixel?${sp}`);
  if (!res.ok) throw new Error(`fetchPixel: ${res.status}`);
  return res.json();
}

export async function fetchEOObservations(index?: string, limit = 50): Promise<{ observations: any[]; count: number }> {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (index) sp.set("index", index);
  const res = await fetch(`/api/eo/observations?${sp}`);
  if (!res.ok) throw new Error(`fetchEOObservations: ${res.status}`);
  return res.json();
}

export async function detectChanges(lng: number, lat: number, index: string): Promise<{ observations: any[]; count: number }> {
  const res = await fetch("/api/eo/observations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lng, lat, index }),
  });
  if (!res.ok) throw new Error(`detectChanges: ${res.status}`);
  return res.json();
}

export async function fetchSceneIndexStats(sceneId: string, index: string): Promise<any> {
  const res = await fetch(`/api/eo/scenes/${sceneId}?index=${index}`);
  if (!res.ok) throw new Error(`fetchSceneIndexStats: ${res.status}`);
  return res.json();
}

// ===== Observation Engine API =====

export interface ObservationEvidence {
  productType: string;
  productId: string | null;
  indexName: string | null;
  value: number;
  normalizedSignal: number;
  weight: number;
  confidence: number;
  uncertainty: number;
  contribution: number;
  description: string;
  direction: "loss" | "gain" | "neutral";
}

export interface ObservationRecord {
  id: string;
  uuid: string;
  type: string;
  title: string;
  summary: string;
  geometry: GeoJSON.Geometry;
  centroid: [number, number];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  areaHa: number;
  observedAt: string;
  firstObserved: string;
  lastUpdated: string;
  durationDays: number | null;
  confidence: number;
  uncertainty: number;
  status: string;
  severity: string;
  currentVersion: number;
  sourceProducts: string[];
  sourceModels: string[];
  mgrsTile: string | null;
  sceneId: string | null;
  evidence: ObservationEvidence[];
  affectedEntities: { entityId: string; relationship: string; distance: number | null }[];
  createdAt: string;
}

export interface ObservationDetail {
  observation: ObservationRecord;
  versions: {
    id: string;
    version: number;
    change: string;
    confidence: number;
    uncertainty: number;
    status: string;
    evidenceCount: number;
    observedAt: string;
  }[];
}

export async function fetchObservations(params: { type?: string; status?: string; severity?: string; limit?: number } = {}): Promise<{ observations: ObservationRecord[]; count: number; types: any[] }> {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.status) sp.set("status", params.status);
  if (params.severity) sp.set("severity", params.severity);
  if (params.limit) sp.set("limit", String(params.limit));
  const res = await fetch(`/api/observations?${sp}`);
  if (!res.ok) throw new Error(`fetchObservations: ${res.status}`);
  return res.json();
}

export async function fetchObservation(id: string): Promise<ObservationDetail> {
  const res = await fetch(`/api/observations/${id}`);
  if (!res.ok) throw new Error(`fetchObservation: ${res.status}`);
  return res.json();
}

export async function triggerObservationScan(mgrsTile?: string): Promise<any> {
  const res = await fetch("/api/observations/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mgrsTile }),
  });
  if (!res.ok) throw new Error(`triggerObservationScan: ${res.status}`);
  return res.json();
}

// ===== Continuous Pipeline & Learning API =====

export interface PipelineStatus {
  grid: { total: number; processed: number; pending: number; stale: number; coveragePct: number };
  lastRun: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    tilesProcessed: number;
    tilesTotal: number;
    observationsCreated: number;
    hypothesesCreated: number;
    durationMs: number;
  } | null;
  recentRuns: { id: string; startedAt: string; status: string; tilesProcessed: number; observationsCreated: number }[];
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch("/api/pipeline/run-continuous");
  if (!res.ok) throw new Error(`fetchPipelineStatus: ${res.status}`);
  return res.json();
}

export async function triggerContinuousPipeline(opts: { tileLimit?: number } = {}): Promise<any> {
  const res = await fetch("/api/pipeline/run-continuous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`triggerContinuousPipeline: ${res.status}`);
  return res.json();
}

export async function fetchGridStatus(): Promise<{ total: number; processed: number; pending: number; stale: number; tiles: any[] }> {
  const res = await fetch("/api/pipeline/status");
  if (!res.ok) throw new Error(`fetchGridStatus: ${res.status}`);
  return res.json();
}

export interface LearnedPrior {
  id: string;
  hypothesisType: string;
  originalPrior: number;
  learnedPrior: number;
  priorDelta: number;
  priorDeltaPct: number;
  confirmations: number;
  rejections: number;
  accuracy: number;
  lastUpdated: string;
}

export async function fetchLearnedPriors(): Promise<{ priors: LearnedPrior[]; count: number }> {
  const res = await fetch("/api/learning/priors");
  if (!res.ok) throw new Error(`fetchLearnedPriors: ${res.status}`);
  return res.json();
}

export async function triggerLearning(): Promise<any> {
  const res = await fetch("/api/learning/update", { method: "POST" });
  if (!res.ok) throw new Error(`triggerLearning: ${res.status}`);
  return res.json();
}

export async function fetchLearningHistory(): Promise<{ updates: any[]; count: number }> {
  const res = await fetch("/api/learning/update");
  if (!res.ok) throw new Error(`fetchLearningHistory: ${res.status}`);
  return res.json();
}

export async function submitFeedback(opts: { observationId?: string; hypothesisId?: string; outcome: string; feedbackType?: string; hypothesisType?: string; notes?: string }): Promise<any> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`submitFeedback: ${res.status}`);
  return res.json();
}

export async function fetchFeedback(outcome?: string): Promise<{ feedback: any[]; count: number }> {
  const sp = new URLSearchParams();
  if (outcome) sp.set("outcome", outcome);
  const res = await fetch(`/api/feedback?${sp}`);
  if (!res.ok) throw new Error(`fetchFeedback: ${res.status}`);
  return res.json();
}

// ===== Intelligence Engine API =====

export interface HypothesisRecord {
  id: string;
  uuid: string;
  observationId: string;
  type: string;
  label: string;
  description: string;
  prior: number;
  posterior: number;
  confidence: number;
  rank: number;
  isPrimary: boolean;
  supportingCount: number;
  contradictingCount: number;
  missingCount: number;
  reasoning: string;
  recommendedVerification: string;
  status: string;
  rulesFired: string[];
  evidence: {
    id: string;
    relationship: string;
    likelihoodRatio: number;
    posteriorContribution: number;
    description: string;
    weight: number;
  }[];
  createdAt: string;
}

export async function fetchHypotheses(params: { type?: string; observationId?: string; limit?: number } = {}): Promise<{ hypotheses: HypothesisRecord[]; count: number; types?: any[] }> {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.observationId) sp.set("observationId", params.observationId);
  if (params.limit) sp.set("limit", String(params.limit));
  const res = await fetch(`/api/hypotheses?${sp}`);
  if (!res.ok) throw new Error(`fetchHypotheses: ${res.status}`);
  return res.json();
}

export async function fetchHypothesis(id: string): Promise<any> {
  const res = await fetch(`/api/hypotheses/${id}`);
  if (!res.ok) throw new Error(`fetchHypothesis: ${res.status}`);
  return res.json();
}

export async function generateHypotheses(observationId: string): Promise<any> {
  const res = await fetch("/api/hypotheses/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observationId }),
  });
  if (!res.ok) throw new Error(`generateHypotheses: ${res.status}`);
  return res.json();
}

export interface EvidenceBundleRecord {
  id: string;
  observationId: string;
  category: string;
  label: string;
  evidenceCount: number;
  meanSignal: number;
  meanConfidence: number;
  fusedUncertainty: number;
  indication: string;
  evidenceIds: string[];
}

export async function fetchBundles(observationId: string): Promise<{ bundles: EvidenceBundleRecord[]; count: number }> {
  const res = await fetch(`/api/bundles?observationId=${observationId}`);
  if (!res.ok) throw new Error(`fetchBundles: ${res.status}`);
  return res.json();
}

export async function fetchRules(): Promise<any> {
  const res = await fetch("/api/rules");
  if (!res.ok) throw new Error(`fetchRules: ${res.status}`);
  return res.json();
}

export interface ScenarioRecord {
  id: string;
  uuid: string;
  type: string;
  label: string;
  description: string;
  forecastDays: number;
  predictedAreaHa: number;
  predictedGrowthPct: number;
  affectedRiversCount: number;
  affectedCommunitiesCount: number;
  expectedSedimentIncrease: number | null;
  confidence: number;
  observationId: string | null;
  phenomenonId: string | null;
  createdAt: string;
}

export async function fetchScenarios(observationId?: string): Promise<{ scenarios: ScenarioRecord[]; count: number }> {
  const sp = new URLSearchParams();
  if (observationId) sp.set("observationId", observationId);
  const res = await fetch(`/api/scenarios?${sp}`);
  if (!res.ok) throw new Error(`fetchScenarios: ${res.status}`);
  return res.json();
}

export async function generateScenario(opts: { observationId?: string; phenomenonId?: string; forecastDays?: number }): Promise<any> {
  const res = await fetch("/api/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`generateScenario: ${res.status}`);
  return res.json();
}

export async function fetchDecisionTrace(hypothesisId: string): Promise<any> {
  const res = await fetch(`/api/decision-trace/${hypothesisId}`);
  if (!res.ok) throw new Error(`fetchDecisionTrace: ${res.status}`);
  return res.json();
}

// ===== Temporal Intelligence API =====

export interface EvidenceRecord {
  id: string;
  uuid: string;
  productType: string;
  indexName: string | null;
  productId: string | null;
  geometry: GeoJSON.Geometry;
  centroid: [number, number];
  observedAt: string;
  value: number;
  normalizedSignal: number;
  confidence: number;
  uncertainty: number;
  direction: string;
  description: string;
  supportingPixels: number;
  supportingSceneId: string | null;
  supportingBandHrefs: string[];
}

export async function fetchEvidence(productType?: string, limit = 200): Promise<{ evidence: EvidenceRecord[]; total: number; count: number }> {
  const sp = new URLSearchParams();
  if (productType) sp.set("productType", productType);
  sp.set("limit", String(limit));
  const res = await fetch(`/api/evidence?${sp}`);
  if (!res.ok) throw new Error(`fetchEvidence: ${res.status}`);
  return res.json();
}

export interface PhenomenonRecord {
  id: string;
  uuid: string;
  type: string;
  title: string;
  summary: string;
  status: string;
  centroid: [number, number];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  currentAreaHa: number;
  firstObserved: string;
  lastObserved: string;
  durationDays: number;
  observationCount: number;
  growthRateHaPerWeek: number | null;
  growthPct: number | null;
  movementKm: number | null;
  persistenceScore: number | null;
  confidence: number;
  uncertainty: number;
  severity: string;
  mgrsTile: string | null;
  observations: {
    observationId: string;
    sequence: number;
    areaHa: number;
    areaDeltaHa: number | null;
    areaDeltaPct: number | null;
    centroidShiftKm: number | null;
    observedAt: string;
    confidence: number;
  }[];
}

export async function fetchPhenomena(type?: string, status?: string, limit = 50): Promise<{ phenomena: PhenomenonRecord[]; total: number; count: number }> {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (status) sp.set("status", status);
  sp.set("limit", String(limit));
  const res = await fetch(`/api/phenomena?${sp}`);
  if (!res.ok) throw new Error(`fetchPhenomena: ${res.status}`);
  return res.json();
}

export async function fetchPhenomenon(id: string): Promise<PhenomenonRecord> {
  const res = await fetch(`/api/phenomena/${id}`);
  if (!res.ok) throw new Error(`fetchPhenomenon: ${res.status}`);
  return res.json();
}

export async function triggerTemporalMerge(): Promise<any> {
  const res = await fetch("/api/phenomena/merge", { method: "POST" });
  if (!res.ok) throw new Error(`triggerTemporalMerge: ${res.status}`);
  return res.json();
}

export interface LineageNode {
  level: string;
  id: string;
  label: string;
  type: string;
  details: Record<string, any>;
  children?: LineageNode[];
}

export async function fetchLineage(observationId: string): Promise<LineageNode> {
  const res = await fetch(`/api/observations/${observationId}/lineage`);
  if (!res.ok) throw new Error(`fetchLineage: ${res.status}`);
  return res.json();
}

export interface KnowledgeNodeRecord {
  id: string;
  conceptId: string;
  label: string;
  category: string;
  description: string;
  color: string;
}

export interface KnowledgeEdgeRecord {
  id: string;
  from: KnowledgeNodeRecord;
  to: KnowledgeNodeRecord;
  relation: string;
  confidence: number;
  description: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNodeRecord[];
  edges: KnowledgeEdgeRecord[];
}

export async function fetchKnowledgeGraph(): Promise<KnowledgeGraph> {
  const res = await fetch("/api/knowledge-graph");
  if (!res.ok) throw new Error(`fetchKnowledgeGraph: ${res.status}`);
  return res.json();
}

// ===== Raster Intelligence API =====

export interface RasterProductMeta {
  id: string;
  type: string;
  indexName: string | null;
  sceneId: string | null;
  mgrsTile: string | null;
  season: string | null;
  gridSize: number;
  meanValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  formula: string;
  sources: string[];
  confidence: number;
  extent: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  computedAt: string;
}

export interface RasterProductDetail extends RasterProductMeta {
  valueGrid: number[];
  uncertaintyGrid: number[];
  stdValue: number | null;
  baselineId: string | null;
}

export interface ProductTypeInfo {
  type: string;
  label: string;
  description: string;
  color: string;
}

export async function fetchRasterProducts(type?: string, mgrsTile?: string): Promise<{ products: RasterProductMeta[]; types: ProductTypeInfo[]; count: number }> {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (mgrsTile) sp.set("mgrsTile", mgrsTile);
  const res = await fetch(`/api/eo/raster-products?${sp}`);
  if (!res.ok) throw new Error(`fetchRasterProducts: ${res.status}`);
  return res.json();
}

export async function fetchRasterProduct(id: string): Promise<RasterProductDetail> {
  const res = await fetch(`/api/eo/raster-products/${id}`);
  if (!res.ok) throw new Error(`fetchRasterProduct: ${res.status}`);
  return res.json();
}

export async function generateRasterProduct(type: string, opts: { sceneId?: string; mgrsTile?: string; indexName?: string } = {}): Promise<any> {
  const res = await fetch("/api/eo/raster-products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...opts }),
  });
  if (!res.ok) throw new Error(`generateRasterProduct: ${res.status}`);
  return res.json();
}

export interface BaselineInfo {
  id: string;
  indexName: string;
  mgrsTile: string;
  season: string;
  sampleCount: number;
  uncertainty: number;
  gridSize: number;
  computedAt: string;
  extent: { minLng: number; minLat: number; maxLng: number; maxLat: number };
}

export async function fetchBaselines(mgrsTile?: string): Promise<{ baselines: BaselineInfo[]; count: number }> {
  const sp = new URLSearchParams();
  if (mgrsTile) sp.set("mgrsTile", mgrsTile);
  const res = await fetch(`/api/eo/baselines?${sp}`);
  if (!res.ok) throw new Error(`fetchBaselines: ${res.status}`);
  return res.json();
}

export async function generateBaseline(mgrsTile: string, indexName: string, season?: string): Promise<any> {
  const res = await fetch("/api/eo/baselines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mgrsTile, indexName, season }),
  });
  if (!res.ok) throw new Error(`generateBaseline: ${res.status}`);
  return res.json();
}

// ---- React hooks ----

export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    // mark loading for this fetch round (async — avoids synchronous setState in effect body)
    Promise.resolve().then(() => {
      if (active) setState((s) => ({ ...s, loading: true, error: null }));
    });
    fn()
      .then((d) => {
        if (active) setState({ data: d, loading: false, error: null });
      })
      .catch((e) => {
        if (active)
          setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      active = false;
    };
  }, [...deps, nonce]);

  return { ...state, refresh };
}
