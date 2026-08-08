// Ghana Digital Twin — Intelligence Engine Domain Types
// Hypotheses are ranked competing explanations. NOT "AI deciding legality."
// Deterministic rules + Bayesian updates + supporting/contradicting evidence.

export type HypothesisType =
  | "artisanal_mining"
  | "road_construction"
  | "flood_erosion"
  | "agricultural_expansion"
  | "quarrying"
  | "deforestation"
  | "natural_clearing"
  | "settlement_expansion"
  | "infrastructure_development";

export type EvidenceRelationship = "supports" | "contradicts" | "neutral";

export type BundleCategory = "vegetation" | "hydrology" | "infrastructure" | "terrain" | "atmospheric";

export interface HypothesisDef {
  type: HypothesisType;
  label: string;
  description: string;
  prior: number; // base-rate prior probability
  recommendedVerification: string;
}

// Hypothesis definitions with base-rate priors
export const HYPOTHESIS_DEFS: Record<HypothesisType, HypothesisDef> = {
  artisanal_mining: {
    type: "artisanal_mining",
    label: "Possible artisanal mining activity",
    description: "Surface disturbance consistent with artisanal (galamsey) mining: vegetation loss + bare soil + water body change + proximity to river. Objective pattern match — no legal conclusion.",
    prior: 0.15, // base rate in Ghana's western belt
    recommendedVerification: "Cross-reference with mining cadastre. Verify with high-resolution imagery. Check for water turbidity downstream.",
  },
  road_construction: {
    type: "road_construction",
    label: "Possible road construction",
    description: "Linear surface disturbance consistent with new road or access track construction.",
    prior: 0.20,
    recommendedVerification: "Check OSM for new road additions. Compare with government infrastructure plans.",
  },
  flood_erosion: {
    type: "flood_erosion",
    label: "Possible flood or erosion event",
    description: "Water body expansion + bare soil consistent with flooding or erosion, especially during rainy season.",
    prior: 0.18,
    recommendedVerification: "Check rainfall data (CHIRPS) for preceding days. Compare with seasonal baseline.",
  },
  agricultural_expansion: {
    type: "agricultural_expansion",
    label: "Possible agricultural expansion",
    description: "Vegetation loss + bare soil in agricultural land-cover context, without water body change or river proximity.",
    prior: 0.22,
    recommendedVerification: "Check land-cover baseline (ESA WorldCover). Look for regular field patterns.",
  },
  quarrying: {
    type: "quarrying",
    label: "Possible quarrying activity",
    description: "Large-scale surface disturbance with bench-cut geometry, without river proximity.",
    prior: 0.08,
    recommendedVerification: "Check for existing quarry permits. Verify bench-cut pattern in high-res imagery.",
  },
  deforestation: {
    type: "deforestation",
    label: "Possible deforestation",
    description: "Significant vegetation loss in forested area, with burn signature or mechanical clearing.",
    prior: 0.10,
    recommendedVerification: "Check if within forest reserve boundary. Cross-reference Hansen GFC.",
  },
  natural_clearing: {
    type: "natural_clearing",
    label: "Possible natural vegetation clearing",
    description: "Vegetation loss consistent with natural dieback, seasonal variation, or fire (non-anthropogenic).",
    prior: 0.05,
    recommendedVerification: "Check for fire signals (VIIRS). Compare with seasonal NDVI baseline.",
  },
  settlement_expansion: {
    type: "settlement_expansion",
    label: "Possible settlement expansion",
    description: "Built-up surface increase at settlement fringe, converting agricultural or vegetated land.",
    prior: 0.15,
    recommendedVerification: "Check Dynamic World built-class trend. Compare with GHSL.",
  },
  infrastructure_development: {
    type: "infrastructure_development",
    label: "Possible infrastructure development",
    description: "Large-scale construction footprint (industrial, port, power) with structured geometry.",
    prior: 0.07,
    recommendedVerification: "Check government development plans. Verify structure footprint in high-res.",
  },
};

// Rules: deterministic evidence → hypothesis mappings
export interface RuleDef {
  ruleId: string;
  name: string;
  description: string;
  category: string;
  hypothesisType: HypothesisType;
  effect: "boost" | "suppress";
  likelihoodRatio: number; // P(E|H) / P(E|¬H). >1 = supports, <1 = contradicts
  // condition: which evidence bundle + indication + minimum signal
  conditions: {
    bundle?: BundleCategory;
    indication?: string; // "vegetation loss", "bare soil increase", "water change"
    minSignal?: number;
    productType?: string;
  }[];
}

// The canonical ruleset — deterministic, auditable, no LLM
export const RULES: RuleDef[] = [
  // ---- Mining hypotheses ----
  {
    ruleId: "rule-mining-01",
    name: "Vegetation loss + bare soil + river proximity → mining boost",
    description: "Surface disturbance near a river with vegetation loss and bare soil exposure is consistent with artisanal mining.",
    category: "mining",
    hypothesisType: "artisanal_mining",
    effect: "boost",
    likelihoodRatio: 3.2,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.3 },
      { bundle: "terrain", indication: "bare soil increase", minSignal: 0.2 },
    ],
  },
  {
    ruleId: "rule-mining-02",
    name: "Water body change near disturbance → mining boost",
    description: "New water body near surface disturbance (pit flooding) is a strong mining indicator.",
    category: "mining",
    hypothesisType: "artisanal_mining",
    effect: "boost",
    likelihoodRatio: 2.8,
    conditions: [
      { bundle: "hydrology", indication: "water body change" },
    ],
  },
  {
    ruleId: "rule-mining-03",
    name: "Seasonal flooding → mining suppress",
    description: "If water change coincides with rainy season baseline, suppress mining hypothesis (natural flood).",
    category: "mining",
    hypothesisType: "artisanal_mining",
    effect: "suppress",
    likelihoodRatio: 0.5,
    conditions: [
      { bundle: "hydrology", indication: "seasonal water expansion" },
    ],
  },
  {
    ruleId: "rule-mining-04",
    name: "Existing mine permit → mining suppress (licensed)",
    description: "If disturbance is within a known licensed concession, it may be permitted mining — suppress artisanal hypothesis.",
    category: "mining",
    hypothesisType: "artisanal_mining",
    effect: "suppress",
    likelihoodRatio: 0.3,
    conditions: [
      { bundle: "infrastructure", indication: "within licensed concession" },
    ],
  },

  // ---- Road construction ----
  {
    ruleId: "rule-road-01",
    name: "Linear disturbance → road boost",
    description: "Linear surface disturbance pattern consistent with road construction.",
    category: "infrastructure",
    hypothesisType: "road_construction",
    effect: "boost",
    likelihoodRatio: 2.5,
    conditions: [
      { bundle: "terrain", indication: "linear disturbance" },
    ],
  },
  {
    ruleId: "rule-road-02",
    name: "Vegetation loss + bare soil without water → road boost",
    description: "Vegetation loss and bare soil without water body change is consistent with road or construction.",
    category: "infrastructure",
    hypothesisType: "road_construction",
    effect: "boost",
    likelihoodRatio: 1.8,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.3 },
      { bundle: "terrain", indication: "bare soil increase", minSignal: 0.2 },
    ],
  },

  // ---- Flood/erosion ----
  {
    ruleId: "rule-flood-01",
    name: "Water expansion + seasonal rain → flood boost",
    description: "Water body expansion during rainy season is consistent with flooding.",
    category: "natural",
    hypothesisType: "flood_erosion",
    effect: "boost",
    likelihoodRatio: 3.0,
    conditions: [
      { bundle: "hydrology", indication: "water body change", minSignal: 0.3 },
      { bundle: "atmospheric", indication: "seasonal rainfall" },
    ],
  },
  {
    ruleId: "rule-flood-02",
    name: "Bare soil near river → erosion boost",
    description: "Bare soil along riverbanks is consistent with erosion.",
    category: "natural",
    hypothesisType: "flood_erosion",
    effect: "boost",
    likelihoodRatio: 2.0,
    conditions: [
      { bundle: "terrain", indication: "bare soil increase" },
      { bundle: "hydrology", indication: "river proximity" },
    ],
  },

  // ---- Agricultural expansion ----
  {
    ruleId: "rule-agri-01",
    name: "Vegetation loss in cultivated land → agriculture boost",
    description: "Vegetation loss in areas classified as cultivated land is consistent with agricultural activity.",
    category: "agriculture",
    hypothesisType: "agricultural_expansion",
    effect: "boost",
    likelihoodRatio: 2.2,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.2 },
      { bundle: "terrain", indication: "agricultural land" },
    ],
  },
  {
    ruleId: "rule-agri-02",
    name: "No water change + no river → agriculture boost",
    description: "Surface disturbance without water body change or river proximity favors agriculture over mining.",
    category: "agriculture",
    hypothesisType: "agricultural_expansion",
    effect: "boost",
    likelihoodRatio: 1.6,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss" },
    ],
  },

  // ---- Deforestation ----
  {
    ruleId: "rule-defor-01",
    name: "Vegetation loss in forest → deforestation boost",
    description: "Significant vegetation loss in forest-classified land is consistent with deforestation.",
    category: "mining",
    hypothesisType: "deforestation",
    effect: "boost",
    likelihoodRatio: 2.8,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.4 },
      { bundle: "terrain", indication: "forest land" },
    ],
  },
  {
    ruleId: "rule-defor-02",
    name: "Burn signature → deforestation boost",
    description: "Burn severity signal indicates fire-assisted deforestation.",
    category: "mining",
    hypothesisType: "deforestation",
    effect: "boost",
    likelihoodRatio: 2.0,
    conditions: [
      { productType: "burn_severity" },
    ],
  },

  // ---- Settlement expansion ----
  {
    ruleId: "rule-settle-01",
    name: "Built-up growth at settlement fringe → settlement boost",
    description: "Surface disturbance at the fringe of existing settlements is consistent with expansion.",
    category: "infrastructure",
    hypothesisType: "settlement_expansion",
    effect: "boost",
    likelihoodRatio: 2.0,
    conditions: [
      { bundle: "infrastructure", indication: "settlement proximity" },
      { bundle: "terrain", indication: "bare soil increase" },
    ],
  },

  // ---- Quarrying ----
  {
    ruleId: "rule-quarry-01",
    name: "Large-scale disturbance without river → quarry boost",
    description: "Large surface disturbance without river proximity is consistent with quarrying.",
    category: "mining",
    hypothesisType: "quarrying",
    effect: "boost",
    likelihoodRatio: 1.8,
    conditions: [
      { bundle: "terrain", indication: "large-scale disturbance" },
    ],
  },

  // ---- Natural clearing (suppress) ----
  {
    ruleId: "rule-natural-01",
    name: "Seasonal NDVI variation → natural clearing boost",
    description: "If NDVI change matches seasonal baseline pattern, boost natural clearing hypothesis.",
    category: "natural",
    hypothesisType: "natural_clearing",
    effect: "boost",
    likelihoodRatio: 2.5,
    conditions: [
      { bundle: "atmospheric", indication: "seasonal baseline match" },
    ],
  },

  // ---- Phase 4.17: Cocoa/CSSVD monitoring ----
  // Cocoa Swollen Shoot Virus Disease (CSSVD) causes progressive vegetation decline
  // in cocoa-growing regions. NDVI anomaly over cocoa areas + absence of bare soil
  // = likely disease rather than clearing.
  {
    ruleId: "rule-cocoa-01",
    name: "NDVI decline in cocoa region → CSSVD boost",
    description: "Progressive vegetation decline in cocoa-growing areas without bare soil exposure is consistent with Cocoa Swollen Shoot Virus Disease.",
    category: "agriculture",
    hypothesisType: "agricultural_expansion",
    effect: "boost",
    likelihoodRatio: 2.2,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.3 },
    ],
  },
  {
    ruleId: "rule-cocoa-02",
    name: "No bare soil + vegetation loss → suppress clearing",
    description: "If vegetation loss occurs without bare soil increase, suppress mining/clearing hypotheses — consistent with disease rather than physical disturbance.",
    category: "agriculture",
    hypothesisType: "artisanal_mining",
    effect: "suppress",
    likelihoodRatio: 0.4,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss" },
    ],
  },

  // ---- Phase 4.18: Enhanced flood risk with rainfall data ----
  // Now that the CHIRPS rainfall connector populates the atmospheric category,
  // high rainfall + water expansion = flood boost (vs mining).
  {
    ruleId: "rule-flood-03",
    name: "High rainfall + water expansion → flood boost",
    description: "Water body expansion coinciding with high rainfall (>150mm/month) is consistent with seasonal flooding, not mining.",
    category: "flood",
    hypothesisType: "flood_erosion",
    effect: "boost",
    likelihoodRatio: 3.5,
    conditions: [
      { bundle: "hydrology", indication: "water expansion" },
      { bundle: "atmospheric", indication: "high rainfall" },
    ],
  },
  {
    ruleId: "rule-flood-04",
    name: "High rainfall → suppress mining (natural water change)",
    description: "If high rainfall is present, water body changes are more likely natural flooding than mining-related.",
    category: "flood",
    hypothesisType: "artisanal_mining",
    effect: "suppress",
    likelihoodRatio: 0.5,
    conditions: [
      { bundle: "atmospheric", indication: "high rainfall" },
    ],
  },

  // ---- Phase 4.19: Forest-reserve boundary detection ----
  // If vegetation loss occurs within a protected forest reserve boundary,
  // it's higher-confidence deforestation (encroachment).
  {
    ruleId: "rule-defor-03",
    name: "Vegetation loss in forest reserve → deforestation strong boost",
    description: "Vegetation loss within a gazetted forest reserve boundary is high-confidence deforestation (encroachment).",
    category: "deforestation",
    hypothesisType: "deforestation",
    effect: "boost",
    likelihoodRatio: 4.0,
    conditions: [
      { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.3 },
      { bundle: "infrastructure", indication: "forest reserve boundary" },
    ],
  },
  {
    ruleId: "rule-defor-04",
    name: "Forest reserve + no river → suppress mining",
    description: "Vegetation loss in a forest reserve without river proximity is more likely deforestation than mining.",
    category: "deforestation",
    hypothesisType: "artisanal_mining",
    effect: "suppress",
    likelihoodRatio: 0.3,
    conditions: [
      { bundle: "infrastructure", indication: "forest reserve boundary" },
    ],
  },

  // ---- Phase 4.20: General land-use change (settlement/road/infrastructure) ----
  // These hypothesis types already existed but had no rules that used the
  // infrastructure evidence category (now populated by OSM + mining cadastre connectors).
  {
    ruleId: "rule-settle-02",
    name: "Built-up expansion + infrastructure proximity → settlement boost",
    description: "Bare soil increase near existing settlement infrastructure is consistent with settlement expansion.",
    category: "infrastructure",
    hypothesisType: "settlement_expansion",
    effect: "boost",
    likelihoodRatio: 2.5,
    conditions: [
      { bundle: "terrain", indication: "bare soil increase", minSignal: 0.2 },
      { bundle: "infrastructure", indication: "settlement proximity" },
    ],
  },
  {
    ruleId: "rule-road-01",
    name: "Linear disturbance + infrastructure → road construction boost",
    description: "Linear bare soil pattern with infrastructure proximity is consistent with road construction.",
    category: "infrastructure",
    hypothesisType: "road_construction",
    effect: "boost",
    likelihoodRatio: 2.0,
    conditions: [
      { bundle: "terrain", indication: "bare soil increase" },
      { bundle: "infrastructure", indication: "road proximity" },
    ],
  },
  {
    ruleId: "rule-infra-01",
    name: "Large-scale disturbance + structured geometry → infrastructure boost",
    description: "Large surface disturbance with structured geometry near existing infrastructure is consistent with industrial development.",
    category: "infrastructure",
    hypothesisType: "infrastructure_development",
    effect: "boost",
    likelihoodRatio: 2.2,
    conditions: [
      { bundle: "terrain", indication: "large-scale disturbance" },
      { bundle: "infrastructure", indication: "infrastructure proximity" },
    ],
  },
];

export const HYPOTHESIS_TYPE_LIST = Object.values(HYPOTHESIS_DEFS);
