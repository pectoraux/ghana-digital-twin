"use client";

import { create } from "zustand";
import type { ViewId, ObservationType, ObservationStatus } from "./types";

export type LayerKey =
  | "rivers"
  | "lakes"
  | "forests"
  | "settlements"
  | "roads"
  | "mining"
  | "dams"
  | "protected"
  | "observations"
  | "regions"
  | "grid"
  | "labels";

interface FeedItem {
  id: string;
  time: number;
  kind: "observation" | "ingest" | "inference";
  text: string;
  detail?: string;
  obsId?: string;
  level: "info" | "warn" | "crit";
}

interface GDTState {
  // navigation
  view: ViewId;
  setView: (v: ViewId) => void;

  // selection
  selectedEntityId: string | null;
  selectedObservationId: string | null;
  selectEntity: (id: string | null) => void;
  selectObservation: (id: string | null) => void;

  // hover
  hoveredEntityId: string | null;
  hoveredObservationId: string | null;
  setHoveredEntity: (id: string | null) => void;
  setHoveredObservation: (id: string | null) => void;

  // inspector
  inspectorOpen: boolean;
  toggleInspector: (open?: boolean) => void;

  // temporal
  temporalDate: string; // ISO "as-of"
  temporalMode: "live" | "historical";
  setTemporalDate: (iso: string) => void;
  setTemporalMode: (m: "live" | "historical") => void;

  // map
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  cursorCoord: [number, number] | null;
  setCursorCoord: (c: [number, number] | null) => void;

  // layers
  layers: Record<LayerKey, boolean>;
  toggleLayer: (k: LayerKey) => void;

  // observation filters
  obsFilter: {
    types: ObservationType[];
    statuses: ObservationStatus[];
    minConfidence: number;
    regionId: string | "all";
  };
  setObsFilter: (f: Partial<GDTState["obsFilter"]>) => void;

  // live feed
  feed: FeedItem[];
  pushFeed: (item: Omit<FeedItem, "id" | "time">) => void;

  // command palette
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  // search
  search: string;
  setSearch: (s: string) => void;
}

let feedCounter = 0;

export const useGDT = create<GDTState>((set) => ({
  view: "atlas",
  setView: (view) => set({ view }),

  selectedEntityId: null,
  selectedObservationId: null,
  selectEntity: (id) => set({ selectedEntityId: id, inspectorOpen: id !== null }),
  selectObservation: (id) =>
    set({ selectedObservationId: id, inspectorOpen: id !== null }),
  setHoveredEntity: (hoveredEntityId) => set({ hoveredEntityId }),
  setHoveredObservation: (hoveredObservationId) => set({ hoveredObservationId }),

  inspectorOpen: false,
  toggleInspector: (open) =>
    set((s) => ({ inspectorOpen: open ?? !s.inspectorOpen })),

  temporalDate: new Date(Date.UTC(2025, 0, 18, 8, 42, 0)).toISOString(),
  temporalMode: "live",
  setTemporalDate: (temporalDate) => set({ temporalDate, temporalMode: "historical" }),
  setTemporalMode: (temporalMode) => set({ temporalMode }),

  zoom: 1,
  pan: { x: 0, y: 0 },
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  cursorCoord: null,
  setCursorCoord: (cursorCoord) => set({ cursorCoord }),

  layers: {
    rivers: true,
    lakes: true,
    forests: true,
    settlements: true,
    roads: true,
    mining: true,
    dams: true,
    protected: true,
    observations: true,
    regions: true,
    grid: true,
    labels: true,
  },
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),

  obsFilter: {
    types: [],
    statuses: [],
    minConfidence: 0,
    regionId: "all",
  },
  setObsFilter: (f) =>
    set((s) => ({ obsFilter: { ...s.obsFilter, ...f } })),

  feed: [
    { id: "f0", time: Date.now() - 40000, kind: "ingest", text: "Sentinel-2 scenes ingested (4)", detail: "cloud-mask 12.4%", level: "info" },
    { id: "f1", time: Date.now() - 90000, kind: "inference", text: "gdt-cv-excav-v4.2 batch complete", detail: "412 tiles → 8 detections", level: "info" },
    { id: "f2", time: Date.now() - 150000, kind: "observation", text: "OBS-2841 New excavation clusters", detail: "Ankobra floodplain · 3.2 ha", level: "crit", obsId: "obs-2841" },
  ],
  pushFeed: (item) =>
    set((s) => ({
      feed: [
        { ...item, id: `f${++feedCounter}`, time: Date.now() },
        ...s.feed,
      ].slice(0, 40),
    })),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  search: "",
  setSearch: (search) => set({ search }),
}));
