// Ghana Digital Twin — Extension Manifest Types
// Extensions declare what they need and what they contribute via manifests.
// The platform validates permissions, loads rules/hypotheses/missions/UI,
// and provides a sandboxed SDK context.

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  icon: string;
  color: string;
  tags: string[];
  // permissions
  permissions: {
    datasets: string[]; // "sentinel2", "sentinel1", "rivers", "weather", "dem"
    compute: string[]; // "raster", "features", "indices"
    ui: string[]; // "dashboards", "inspector", "atlas_overlay"
    missions: string[]; // "drone", "community", "inspector"
    alerts: boolean;
    learning: boolean; // can submit feedback to learning engine
  };
  // what the extension contributes
  contributes: {
    rules: ExtensionRuleDef[];
    hypothesisTypes: { type: string; label: string; prior: number; description: string; recommendedVerification: string }[];
    missionTypes: { type: string; label: string; description: string; baseCost: number; baseInfoGain: number }[];
    observationTypes: { type: string; label: string; description: string }[];
    uiViews: { id: string; label: string; component: string; icon: string }[];
  };
  // config schema
  config: { key: string; label: string; type: "number" | "string" | "boolean"; default: any; description?: string }[];
}

export interface ExtensionRuleDef {
  ruleId: string;
  name: string;
  description: string;
  conditions: { bundle?: string; indication?: string; minSignal?: number; productType?: string }[];
  hypothesisType: string;
  effect: "boost" | "suppress";
  likelihoodRatio: number;
  priority: number;
}

// ---- Built-in Extension Manifests ----

export const BUILTIN_EXTENSIONS: ExtensionManifest[] = [
  {
    id: "illegal-mining",
    name: "Illegal Mining Detection",
    version: "2.1.0",
    description: "Detects surface disturbance, excavation signatures, water turbidity, and river impact consistent with artisanal mining. Generates mining hypotheses with SAR and community verification missions.",
    author: "Ghana Digital Twin",
    category: "mining",
    icon: "pickaxe",
    color: "#f43f5e",
    tags: ["mining", "excavation", "galamsey", "water-turbidity", "surface-disturbance"],
    permissions: {
      datasets: ["sentinel2", "sentinel1", "rivers", "roads", "weather", "dem", "nightlights", "population"],
      compute: ["raster", "features", "indices"],
      ui: ["dashboards", "inspector", "atlas_overlay"],
      missions: ["drone", "community", "inspector", "iot", "sar_tasking"],
      alerts: true,
      learning: true,
    },
    contributes: {
      rules: [
        {
          ruleId: "mining-01",
          name: "Vegetation loss + bare soil + river proximity → mining boost",
          description: "Surface disturbance near a river with vegetation loss and bare soil is consistent with artisanal mining.",
          conditions: [
            { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.3 },
            { bundle: "terrain", indication: "bare soil increase", minSignal: 0.2 },
          ],
          hypothesisType: "artisanal_mining",
          effect: "boost",
          likelihoodRatio: 3.2,
          priority: 1,
        },
        {
          ruleId: "mining-02",
          name: "Water body change near disturbance → mining boost",
          description: "New water body near surface disturbance (pit flooding) is a strong mining indicator.",
          conditions: [{ bundle: "hydrology", indication: "water body change" }],
          hypothesisType: "artisanal_mining",
          effect: "boost",
          likelihoodRatio: 2.8,
          priority: 2,
        },
        {
          ruleId: "mining-03",
          name: "Seasonal flooding → mining suppress",
          description: "If water change coincides with rainy season, suppress mining hypothesis.",
          conditions: [{ bundle: "atmospheric", indication: "seasonal water expansion" }],
          hypothesisType: "artisanal_mining",
          effect: "suppress",
          likelihoodRatio: 0.5,
          priority: 3,
        },
        {
          ruleId: "mining-04",
          name: "Existing mine permit → suppress artisanal",
          description: "If within licensed concession, suppress artisanal mining hypothesis.",
          conditions: [{ bundle: "infrastructure", indication: "within licensed concession" }],
          hypothesisType: "artisanal_mining",
          effect: "suppress",
          likelihoodRatio: 0.3,
          priority: 4,
        },
        {
          ruleId: "mining-05",
          name: "Night lights increase near disturbance → mining boost",
          description: "Nighttime lights increase near surface disturbance may indicate mining camp or processing equipment.",
          conditions: [{ productType: "nightlights" }],
          hypothesisType: "artisanal_mining",
          effect: "boost",
          likelihoodRatio: 1.8,
          priority: 5,
        },
      ],
      hypothesisTypes: [
        {
          type: "artisanal_mining",
          label: "Possible artisanal mining activity",
          prior: 0.15,
          description: "Surface disturbance consistent with artisanal (galamsey) mining. Objective pattern match — no legal conclusion.",
          recommendedVerification: "Cross-reference with mining cadastre. Verify with high-resolution imagery. Check water turbidity downstream.",
        },
        {
          type: "quarrying",
          label: "Possible quarrying activity",
          prior: 0.08,
          description: "Large-scale surface disturbance with bench-cut geometry, without river proximity.",
          recommendedVerification: "Check for existing quarry permits. Verify bench-cut pattern in high-res imagery.",
        },
      ],
      missionTypes: [
        { type: "sar_tasking", label: "SAR Imagery Tasking", description: "Task Sentinel-1 SAR to detect excavation through clouds", baseCost: 600, baseInfoGain: 0.42 },
        { type: "drone", label: "Drone Survey", description: "High-resolution drone imagery for pit geometry verification", baseCost: 200, baseInfoGain: 0.55 },
        { type: "iot", label: "River Turbidity Sensor", description: "Deploy river sensor to measure downstream sediment from excavation", baseCost: 500, baseInfoGain: 0.35 },
        { type: "community", label: "Community Mining Reports", description: "Ask nearby community about mining activity, machinery, water changes", baseCost: 5, baseInfoGain: 0.31 },
      ],
      observationTypes: [
        { type: "excavation_signature", label: "Excavation Signature", description: "Surface disturbance with pit geometry and spoil piles" },
        { type: "water_turbidity", label: "Water Turbidity Anomaly", description: "Spectral turbidity increase downstream of disturbance" },
        { type: "mine_expansion", label: "Mine Expansion", description: "Growth of existing mining footprint" },
        { type: "river_impact", label: "River Impact", description: "Downstream sediment loading from mining activity" },
      ],
      uiViews: [
        { id: "mining-dashboard", label: "Mining Dashboard", component: "MiningDashboard", icon: "pickaxe" },
        { id: "mining-inspector", label: "Mining Inspector", component: "MiningInspector", icon: "search" },
      ],
    },
    config: [
      { key: "confidence_threshold", label: "Confidence Threshold", type: "number", default: 0.6, description: "Minimum confidence for mining alerts" },
      { key: "river_buffer_km", label: "River Buffer (km)", type: "number", default: 2, description: "Distance from river to flag as high-risk" },
      { key: "enable_alerts", label: "Enable Alerts", type: "boolean", default: true, description: "Send alerts for critical mining detections" },
    ],
  },

  {
    id: "flood-monitoring",
    name: "Flood Monitoring",
    version: "1.7.3",
    description: "Detects flood extent, affected infrastructure, and population impact using SAR, optical, rainfall, and DEM data. Generates flood hypotheses with IoT and community verification missions.",
    author: "Ghana Digital Twin",
    category: "flood",
    icon: "waves",
    color: "#22d3ee",
    tags: ["flood", "inundation", "rainfall", "disaster-response", "infrastructure-impact"],
    permissions: {
      datasets: ["sentinel2", "sentinel1", "weather", "dem", "rivers", "roads", "population"],
      compute: ["raster", "features", "indices"],
      ui: ["dashboards", "atlas_overlay"],
      missions: ["community", "iot", "inspector"],
      alerts: true,
      learning: true,
    },
    contributes: {
      rules: [
        {
          ruleId: "flood-01",
          name: "Water expansion + heavy rainfall → flood boost",
          description: "Water body expansion during heavy rainfall is consistent with flooding.",
          conditions: [
            { bundle: "hydrology", indication: "water body change", minSignal: 0.3 },
            { bundle: "atmospheric", indication: "heavy rainfall" },
          ],
          hypothesisType: "flood_erosion",
          effect: "boost",
          likelihoodRatio: 3.0,
          priority: 1,
        },
        {
          ruleId: "flood-02",
          name: "Bare soil near river → erosion boost",
          description: "Bare soil along riverbanks is consistent with erosion.",
          conditions: [
            { bundle: "terrain", indication: "bare soil increase" },
            { bundle: "hydrology", indication: "river proximity" },
          ],
          hypothesisType: "flood_erosion",
          effect: "boost",
          likelihoodRatio: 2.0,
          priority: 2,
        },
        {
          ruleId: "flood-03",
          name: "Low elevation + high flow accumulation → flood susceptibility",
          description: "Low-lying areas with high upstream flow are flood-susceptible.",
          conditions: [{ productType: "dem" }],
          hypothesisType: "flood_erosion",
          effect: "boost",
          likelihoodRatio: 1.5,
          priority: 3,
        },
      ],
      hypothesisTypes: [
        {
          type: "flood_erosion",
          label: "Possible flood or erosion event",
          prior: 0.18,
          description: "Water body expansion + bare soil consistent with flooding or erosion, especially during rainy season.",
          recommendedVerification: "Check rainfall data (CHIRPS) for preceding days. Deploy river flow sensor.",
        },
      ],
      missionTypes: [
        { type: "iot", label: "River Flow Sensor", description: "Deploy river sensor for water level and flow rate", baseCost: 500, baseInfoGain: 0.45 },
        { type: "community", label: "Community Flood Reports", description: "Ask community about flooding, property damage, water levels", baseCost: 5, baseInfoGain: 0.28 },
        { type: "inspector", label: "Damage Assessment", description: "Field inspector for flood damage assessment", baseCost: 50, baseInfoGain: 0.60 },
      ],
      observationTypes: [
        { type: "flood_extent", label: "Flood Extent", description: "Area of new water coverage" },
        { type: "flood_depth", label: "Flood Depth", description: "Estimated water depth using DEM" },
        { type: "affected_roads", label: "Affected Roads", description: "Roads inundated by flooding" },
        { type: "affected_buildings", label: "Affected Buildings", description: "Buildings within flood extent" },
        { type: "population_impact", label: "Population Impact", description: "Estimated population affected" },
      ],
      uiViews: [
        { id: "flood-dashboard", label: "Flood Dashboard", component: "FloodDashboard", icon: "waves" },
      ],
    },
    config: [
      { key: "rainfall_threshold_mm", label: "Rainfall Threshold (mm/24h)", type: "number", default: 50, description: "Rainfall that triggers flood watch" },
      { key: "evacuation_zone_m", label: "Evacuation Zone (m)", type: "number", default: 500, description: "Buffer around flood for evacuation planning" },
    ],
  },

  {
    id: "cocoa-agriculture",
    name: "Cocoa Agriculture Monitor",
    version: "3.0.0",
    description: "Monitors cocoa farm health, stress detection, disease risk, and yield prediction using NDVI, rainfall, temperature, and elevation data.",
    author: "Ghana Digital Twin",
    category: "agriculture",
    icon: "leaf",
    color: "#84cc16",
    tags: ["cocoa", "agriculture", "crop-health", "yield", "disease"],
    permissions: {
      datasets: ["sentinel2", "weather", "dem"],
      compute: ["raster", "indices", "features"],
      ui: ["dashboards"],
      missions: ["community", "drone"],
      alerts: true,
      learning: true,
    },
    contributes: {
      rules: [
        {
          ruleId: "cocoa-01",
          name: "NDVI decline in cocoa zone → stress boost",
          description: "NDVI decline in cocoa-growing regions indicates crop stress.",
          conditions: [
            { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.2 },
            { productType: "ndvi" },
          ],
          hypothesisType: "agricultural_expansion",
          effect: "boost",
          likelihoodRatio: 2.2,
          priority: 1,
        },
        {
          ruleId: "cocoa-02",
          name: "Low rainfall + high temperature → disease risk boost",
          description: "Drought conditions increase cocoa stress and disease susceptibility.",
          conditions: [
            { bundle: "atmospheric", indication: "low rainfall" },
            { bundle: "atmospheric", indication: "high temperature" },
          ],
          hypothesisType: "moisture_stress",
          effect: "boost",
          likelihoodRatio: 1.8,
          priority: 2,
        },
      ],
      hypothesisTypes: [
        {
          type: "moisture_stress",
          label: "Cocoa moisture stress",
          prior: 0.12,
          description: "Drying conditions or water deficit affecting cocoa vegetation.",
          recommendedVerification: "Community confirmation of farming conditions. Soil moisture sensor deployment.",
        },
      ],
      missionTypes: [
        { type: "community", label: "Farmer Survey", description: "Ask cocoa farmers about crop health, disease, harvest expectations", baseCost: 5, baseInfoGain: 0.40 },
        { type: "drone", label: "Crop Health Drone", description: "Drone survey for crop disease and stress patterns", baseCost: 200, baseInfoGain: 0.50 },
      ],
      observationTypes: [
        { type: "crop_stress", label: "Crop Stress", description: "Vegetation stress in agricultural land" },
        { type: "disease_risk", label: "Disease Risk", description: "Conditions favorable for cocoa disease" },
        { type: "yield_prediction", label: "Yield Prediction", description: "Estimated crop yield based on NDVI trend" },
      ],
      uiViews: [
        { id: "cocoa-dashboard", label: "Cocoa Dashboard", component: "CocoaDashboard", icon: "leaf" },
      ],
    },
    config: [
      { key: "ndvi_stress_threshold", label: "NDVI Stress Threshold", type: "number", default: 0.35, description: "NDVI below this triggers stress alert" },
      { key: "growing_season_start", label: "Growing Season Start", type: "string", default: "April", description: "Start of cocoa growing season" },
    ],
  },

  {
    id: "forest-monitoring",
    name: "Forest Monitoring",
    version: "1.4.2",
    description: "Detects deforestation, canopy loss, and habitat fragmentation using NDVI, NBR, Hansen GFC, and protected area boundaries.",
    author: "Ghana Digital Twin",
    category: "forestry",
    icon: "tree",
    color: "#34d399",
    tags: ["forest", "deforestation", "canopy", "habitat", "protected-areas"],
    permissions: {
      datasets: ["sentinel2", "dem", "rivers"],
      compute: ["raster", "indices"],
      ui: ["dashboards", "atlas_overlay"],
      missions: ["drone", "inspector"],
      alerts: true,
      learning: true,
    },
    contributes: {
      rules: [
        {
          ruleId: "forest-01",
          name: "Vegetation loss in forest → deforestation boost",
          description: "Significant vegetation loss in forest-classified land indicates deforestation.",
          conditions: [
            { bundle: "vegetation", indication: "vegetation loss", minSignal: 0.4 },
            { bundle: "terrain", indication: "forest land" },
          ],
          hypothesisType: "deforestation",
          effect: "boost",
          likelihoodRatio: 2.8,
          priority: 1,
        },
        {
          ruleId: "forest-02",
          name: "Burn signature → deforestation boost",
          description: "Burn severity signal indicates fire-assisted deforestation.",
          conditions: [{ productType: "burn_severity" }],
          hypothesisType: "deforestation",
          effect: "boost",
          likelihoodRatio: 2.0,
          priority: 2,
        },
      ],
      hypothesisTypes: [
        {
          type: "deforestation",
          label: "Possible deforestation",
          prior: 0.10,
          description: "Significant vegetation loss in forested area, with burn or mechanical clearing signature.",
          recommendedVerification: "Check if within forest reserve boundary. Cross-reference Hansen GFC.",
        },
      ],
      missionTypes: [
        { type: "drone", label: "Canopy Drone Survey", description: "Drone imagery for canopy loss assessment and clearing method identification", baseCost: 200, baseInfoGain: 0.55 },
        { type: "inspector", label: "Forest Patrol", description: "Field officer for reserve boundary check and illegal logging verification", baseCost: 50, baseInfoGain: 0.65 },
      ],
      observationTypes: [
        { type: "canopy_loss", label: "Canopy Loss", description: "Tree canopy removal detected" },
        { type: "habitat_fragmentation", label: "Habitat Fragmentation", description: "Forest connectivity disrupted" },
        { type: "reserve_encroachment", label: "Reserve Encroachment", description: "Activity within protected area boundary" },
      ],
      uiViews: [
        { id: "forest-dashboard", label: "Forest Dashboard", component: "ForestDashboard", icon: "tree" },
      ],
    },
    config: [
      { key: "canopy_loss_threshold_ha", label: "Canopy Loss Threshold (ha)", type: "number", default: 0.5, description: "Minimum area to trigger deforestation alert" },
      { key: "protected_area_buffer_m", label: "Protected Area Buffer (m)", type: "number", default: 500, description: "Buffer around protected areas for encroachment alerts" },
    ],
  },
];
