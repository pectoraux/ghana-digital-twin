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
