// Ghana Digital Twin — Environmental Knowledge Graph
// Domain knowledge connecting environmental concepts. Separate from World Model
// (which represents physical entities). This represents causal/conceptual relationships:
// "vegetation loss → often precedes → bare soil increase → often affects → downstream communities"

import { db } from "@/lib/db";

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

// Seed domain knowledge (idempotent)
const DOMAIN_CONCEPTS: { conceptId: string; label: string; category: string; description: string; color: string }[] = [
  { conceptId: "vegetation_loss", label: "Vegetation Loss", category: "indicator", description: "Decline in vegetation greenness/biomass (NDVI decrease).", color: "#f97316" },
  { conceptId: "bare_soil", label: "Bare Soil Exposure", category: "indicator", description: "Exposed soil surface (high BSI). Indicates ground disturbance.", color: "#f59e0b" },
  { conceptId: "water_turbidity", label: "Water Turbidity", category: "indicator", description: "Increased suspended sediment in water bodies.", color: "#fb923c" },
  { conceptId: "water_body_change", label: "Water Body Change", category: "indicator", description: "New, lost, or altered water body extent.", color: "#22d3ee" },
  { conceptId: "surface_disturbance", label: "Surface Disturbance", category: "effect", description: "Physical ground surface change — excavation, construction, clearing.", color: "#fb7185" },
  { conceptId: "burn_event", label: "Burn Event", category: "effect", description: "Fire or severe vegetation stress (high dNBR).", color: "#ef4444" },
  { conceptId: "moisture_stress", label: "Moisture Stress", category: "condition", description: "Drying conditions or water deficit.", color: "#a78bfa" },
  { conceptId: "new_road", label: "New Road", category: "cause", description: "Newly constructed road or access track.", color: "#94a3b8" },
  { conceptId: "settlement_expansion", label: "Settlement Expansion", category: "cause", description: "Built-up area growth.", color: "#fbbf24" },
  { conceptId: "excavation", label: "Excavation", category: "cause", description: "Ground excavation — pit digging, mining, quarrying.", color: "#f43f5e" },
  { conceptId: "deforestation", label: "Deforestation", category: "cause", description: "Forest canopy removal.", color: "#dc2626" },
  { conceptId: "flooding", label: "Flooding", category: "effect", description: "Water extent exceeding normal levels.", color: "#06b6d4" },
  { conceptId: "downstream_communities", label: "Downstream Communities", category: "entity_type", description: "Settlements downstream of a change, potentially affected.", color: "#84cc16" },
  { conceptId: "river_ecosystem", label: "River Ecosystem", category: "entity_type", description: "River and riparian ecosystem health.", color: "#2dd4bf" },
  { conceptId: "protected_area", label: "Protected Area", category: "entity_type", description: "Designated conservation area.", color: "#34d399" },
  { conceptId: "seasonal_rain", label: "Seasonal Rainfall", category: "condition", description: "Expected seasonal rainfall pattern.", color: "#60a5fa" },
];

const DOMAIN_EDGES: { from: string; to: string; relation: string; confidence: number; description: string }[] = [
  { from: "vegetation_loss", to: "bare_soil", relation: "often_precedes", confidence: 0.85, description: "Vegetation loss often precedes bare soil exposure." },
  { from: "bare_soil", to: "water_turbidity", relation: "causes", confidence: 0.75, description: "Exposed soil increases runoff sediment → water turbidity." },
  { from: "water_turbidity", to: "downstream_communities", relation: "affects", confidence: 0.80, description: "Turbid water affects downstream water supply." },
  { from: "water_turbidity", to: "river_ecosystem", relation: "affects", confidence: 0.85, description: "Turbidity impacts aquatic ecosystems." },
  { from: "excavation", to: "vegetation_loss", relation: "causes", confidence: 0.80, description: "Excavation removes vegetation cover." },
  { from: "excavation", to: "bare_soil", relation: "causes", confidence: 0.90, description: "Excavation exposes bare soil." },
  { from: "excavation", to: "water_body_change", relation: "causes", confidence: 0.65, description: "Excavation can create new water bodies (pit flooding)." },
  { from: "new_road", to: "surface_disturbance", relation: "causes", confidence: 0.85, description: "Road construction causes surface disturbance." },
  { from: "new_road", to: "vegetation_loss", relation: "causes", confidence: 0.70, description: "Road construction clears vegetation." },
  { from: "deforestation", to: "vegetation_loss", relation: "is_a", confidence: 0.95, description: "Deforestation is a form of vegetation loss." },
  { from: "deforestation", to: "bare_soil", relation: "causes", confidence: 0.80, description: "Deforestation exposes bare soil." },
  { from: "settlement_expansion", to: "vegetation_loss", relation: "causes", confidence: 0.75, description: "Settlement growth converts vegetated land." },
  { from: "settlement_expansion", to: "surface_disturbance", relation: "causes", confidence: 0.70, description: "Construction causes surface disturbance." },
  { from: "burn_event", to: "vegetation_loss", relation: "causes", confidence: 0.90, description: "Fire causes vegetation loss." },
  { from: "burn_event", to: "bare_soil", relation: "causes", confidence: 0.75, description: "Burn exposes bare soil." },
  { from: "seasonal_rain", to: "water_turbidity", relation: "correlates_with", confidence: 0.60, description: "Seasonal rain naturally increases turbidity — baseline consideration." },
  { from: "seasonal_rain", to: "water_body_change", relation: "correlates_with", confidence: 0.65, description: "Seasonal rain naturally expands water extent." },
  { from: "seasonal_rain", to: "moisture_stress", relation: "negatively_correlates", confidence: 0.70, description: "Rain reduces moisture stress." },
  { from: "moisture_stress", to: "vegetation_loss", relation: "causes", confidence: 0.65, description: "Prolonged moisture stress causes vegetation decline." },
  { from: "surface_disturbance", to: "protected_area", relation: "may_threaten", confidence: 0.60, description: "Surface disturbance near protected areas may threaten them." },
  { from: "water_body_change", to: "flooding", relation: "may_indicate", confidence: 0.55, description: "Water expansion may indicate flooding." },
];

export async function seedKnowledgeGraph(): Promise<void> {
  // seed nodes
  for (const c of DOMAIN_CONCEPTS) {
    await db.knowledgeNode.upsert({
      where: { conceptId: c.conceptId },
      update: { label: c.label, category: c.category, description: c.description, color: c.color },
      create: c,
    });
  }

  // seed edges
  const nodeMap = new Map<string, string>();
  const nodes = await db.knowledgeNode.findMany();
  for (const n of nodes) nodeMap.set(n.conceptId, n.id);

  for (const e of DOMAIN_EDGES) {
    const fromId = nodeMap.get(e.from);
    const toId = nodeMap.get(e.to);
    if (!fromId || !toId) continue;
    await db.knowledgeEdge.upsert({
      where: { fromNodeId_toNodeId_relation: { fromNodeId: fromId, toNodeId: toId, relation: e.relation } },
      update: { confidence: e.confidence, description: e.description },
      create: { fromNodeId: fromId, toNodeId: toId, relation: e.relation, confidence: e.confidence, description: e.description },
    });
  }
}

export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const [nodes, edges] = await Promise.all([
    db.knowledgeNode.findMany(),
    db.knowledgeEdge.findMany({ include: { fromNode: true, toNode: true } }),
  ]);

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      conceptId: n.conceptId,
      label: n.label,
      category: n.category,
      description: n.description,
      color: n.color,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: {
        id: e.fromNode.id,
        conceptId: e.fromNode.conceptId,
        label: e.fromNode.label,
        category: e.fromNode.category,
        description: e.fromNode.description,
        color: e.fromNode.color,
      },
      to: {
        id: e.toNode.id,
        conceptId: e.toNode.conceptId,
        label: e.toNode.label,
        category: e.toNode.category,
        description: e.toNode.description,
        color: e.toNode.color,
      },
      relation: e.relation,
      confidence: e.confidence,
      description: e.description,
    })),
  };
}
