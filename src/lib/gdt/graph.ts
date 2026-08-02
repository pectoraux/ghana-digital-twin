// Ghana Digital Twin — Geospatial Knowledge Graph
// Entities connected through typed relationships. Supports cross-graph reasoning.

import type { GraphNode, GraphEdge } from "./types";

// Layout in a 960 x 660 canvas. Clustered by sub-domain.
export const GRAPH_NODES: GraphNode[] = [
  // Mining-river cluster (center-left)
  { id: "ent-ankobra-river", label: "Ankobra River", kind: "river", x: 470, y: 330, region: "Western" },
  { id: "ent-prestea-galamsey", label: "Prestea Galamsey", kind: "excavation", x: 300, y: 220, region: "Western" },
  { id: "ent-prestea-mined-pond", label: "Mined Pond", kind: "waterbody_mined", x: 392, y: 140, region: "Western" },
  { id: "obs-2841", label: "OBS-2841 Excavation", kind: "observation", x: 240, y: 320, region: "Western" },
  { id: "obs-2840", label: "OBS-2840 Turbidity", kind: "observation", x: 240, y: 420, region: "Western" },

  // Watershed / Pra cluster (right)
  { id: "ent-pra-river", label: "Pra River", kind: "river", x: 660, y: 250, region: "Western" },
  { id: "ent-offin-river", label: "Offin River", kind: "river", x: 640, y: 140, region: "Ashanti" },
  { id: "ent-pra-watershed", label: "Pra Watershed", kind: "watershed", x: 800, y: 330, region: "Western" },
  { id: "obs-2829", label: "OBS-2829 Turbidity", kind: "observation", x: 720, y: 410, region: "Ashanti" },

  // Forest cluster (top)
  { id: "ent-atewa-range", label: "Atewa Range", kind: "forest", x: 530, y: 88, region: "Eastern" },
  { id: "obs-2839", label: "OBS-2839 Canopy Loss", kind: "observation", x: 430, y: 36, region: "Eastern" },
  { id: "ent-mole-np", label: "Mole NP", kind: "protected_area", x: 790, y: 70, region: "Savannah" },
  { id: "obs-2831", label: "OBS-2831 Clearing", kind: "observation", x: 870, y: 150, region: "Savannah" },

  // Lake / Volta cluster (bottom-left)
  { id: "ent-lake-volta", label: "Lake Volta", kind: "lake", x: 150, y: 470, region: "Volta" },
  { id: "ent-volta-river", label: "Volta River", kind: "river", x: 300, y: 540, region: "Volta" },
  { id: "ent-akosombo-dam", label: "Akosombo Dam", kind: "dam", x: 220, y: 470, region: "Eastern" },
  { id: "ent-coastline", label: "Gulf of Guinea", kind: "coastline", x: 120, y: 600, region: "Coastal" },

  // Datasets (left edge)
  { id: "src-s2", label: "Sentinel-2", kind: "observation", x: 90, y: 110, region: "Source" },
  { id: "src-s1", label: "Sentinel-1", kind: "observation", x: 90, y: 220, region: "Source" },
];

export const GRAPH_EDGES: GraphEdge[] = [
  { source: "ent-prestea-galamsey", target: "ent-ankobra-river", relation: "affects" },
  { source: "obs-2841", target: "ent-ankobra-river", relation: "observes" },
  { source: "obs-2841", target: "ent-prestea-galamsey", relation: "observes" },
  { source: "obs-2841", target: "ent-prestea-mined-pond", relation: "creates" },
  { source: "obs-2840", target: "ent-ankobra-river", relation: "observes" },
  { source: "obs-2840", target: "ent-prestea-galamsey", relation: "caused_by" },
  { source: "ent-prestea-mined-pond", target: "ent-ankobra-river", relation: "adjacent_to" },
  { source: "ent-ankobra-river", target: "ent-coastline", relation: "flows_to" },
  { source: "ent-offin-river", target: "ent-pra-river", relation: "tributary_of" },
  { source: "ent-pra-river", target: "ent-pra-watershed", relation: "part_of" },
  { source: "ent-pra-river", target: "ent-coastline", relation: "flows_to" },
  { source: "obs-2829", target: "ent-pra-river", relation: "observes" },
  { source: "obs-2829", target: "ent-offin-river", relation: "observes" },
  { source: "obs-2839", target: "ent-atewa-range", relation: "observes" },
  { source: "obs-2831", target: "ent-mole-np", relation: "observes" },
  { source: "ent-volta-river", target: "ent-lake-volta", relation: "outflow_of" },
  { source: "ent-akosombo-dam", target: "ent-lake-volta", relation: "impounds" },
  { source: "ent-lake-volta", target: "ent-volta-river", relation: "feeds" },
  { source: "ent-volta-river", target: "ent-coastline", relation: "flows_to" },
  { source: "src-s2", target: "obs-2841", relation: "feeds" },
  { source: "src-s1", target: "obs-2841", relation: "feeds" },
  { source: "src-s2", target: "obs-2840", relation: "feeds" },
  { source: "src-s2", target: "obs-2839", relation: "feeds" },
  { source: "src-s1", target: "obs-2839", relation: "feeds" },
  { source: "src-s2", target: "obs-2831", relation: "feeds" },
];
