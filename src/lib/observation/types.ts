// Ghana Digital Twin — Observation Engine Domain Types
// Observations are fused from multiple raster products. Never a single source.

export type ObservationType =
  | "surface_disturbance"
  | "water_body_change"
  | "vegetation_loss"
  | "burn_event"
  | "moisture_stress";

export type ObservationStatus = "candidate" | "active" | "monitoring" | "resolved";

export type Severity = "low" | "moderate" | "high" | "critical";

// Fusion rule: which products to combine for an observation type, and how to weight them
export interface FusionRule {
  type: ObservationType;
  label: string;
  description: string;
  // products that contribute evidence, with their fusion weights and signal normalization
  evidenceSources: {
    productType: string;
    weight: number; // relative weight in fusion (0..1)
    // signal extraction: how to interpret the product value as a 0..1 anomaly signal
    // for z-score products: signal = clamp(|z| / 3, 0, 1) with direction
    // for probability products: signal = value directly
    // for bare_soil: signal = max(0, value - 0.4) / 0.6 (soil above 0.4 threshold)
    extractSignal: (value: number) => { signal: number; direction: "loss" | "gain" | "neutral" };
    description: (value: number, signal: number) => string;
  }[];
  // minimum fused signal to create an observation
  threshold: number;
  // minimum number of evidence sources required (fusion requires multiple sources)
  minEvidenceSources: number;
  // severity mapping
  severityFromSignal: (fusedSignal: number, areaHa: number) => Severity;
}

// The canonical fusion rules for each observation type
export const FUSION_RULES: Record<ObservationType, FusionRule> = {
  surface_disturbance: {
    type: "surface_disturbance",
    label: "Surface Disturbance",
    description: "Fused detection of physical surface change — vegetation loss + bare soil exposure + change probability. Indicates ground disturbance without asserting cause.",
    evidenceSources: [
      {
        productType: "vegetation_anomaly",
        weight: 0.35,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          // negative z-score = vegetation loss
          const signal = Math.min(1, Math.abs(Math.min(0, v)) / 3);
          return { signal, direction: v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `NDVI anomaly z=${v.toFixed(2)} (vegetation loss signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "bare_soil",
        weight: 0.30,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          // bare soil above 0.4 threshold
          const signal = Math.max(0, Math.min(1, (v - 0.4) / 0.6));
          return { signal, direction: signal > 0.1 ? "gain" : "neutral" };
        },
        description: (v, s) => `Bare soil likelihood ${(v * 100).toFixed(0)}% (excess signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "change_probability",
        weight: 0.35,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          return { signal: Math.min(1, v), direction: v > 0.5 ? "loss" : "neutral" };
        },
        description: (v, s) => `Change probability ${(v * 100).toFixed(0)}% (fused signal ${(s * 100).toFixed(0)}%)`,
      },
    ],
    threshold: 0.35,
    minEvidenceSources: 2,
    severityFromSignal: (signal, areaHa) => {
      if (signal > 0.7 && areaHa > 5) return "critical";
      if (signal > 0.6 || areaHa > 2) return "high";
      if (signal > 0.45) return "moderate";
      return "low";
    },
  },

  water_body_change: {
    type: "water_body_change",
    label: "Water Body Change",
    description: "Fused detection of water extent or quality change — NDWI anomaly + moisture anomaly. Indicates new, lost, or altered water bodies.",
    evidenceSources: [
      {
        productType: "water_anomaly",
        weight: 0.60,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.abs(v) / 3);
          return { signal, direction: v > 1 ? "gain" : v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `NDWI anomaly z=${v.toFixed(2)} (water change signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "moisture_anomaly",
        weight: 0.40,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.abs(v) / 3);
          return { signal, direction: v > 1 ? "gain" : v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `Moisture anomaly z=${v.toFixed(2)} (moisture change signal ${(s * 100).toFixed(0)}%)`,
      },
    ],
    threshold: 0.40,
    minEvidenceSources: 2,
    severityFromSignal: (signal, areaHa) => {
      if (signal > 0.65 && areaHa > 3) return "critical";
      if (signal > 0.55 || areaHa > 1) return "high";
      if (signal > 0.45) return "moderate";
      return "low";
    },
  },

  vegetation_loss: {
    type: "vegetation_loss",
    label: "Vegetation Loss",
    description: "Fused detection of canopy/vegetation decline — vegetation anomaly + temporal variance + burn severity. Indicates persistent vegetation decrease.",
    evidenceSources: [
      {
        productType: "vegetation_anomaly",
        weight: 0.45,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.abs(Math.min(0, v)) / 3);
          return { signal, direction: v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `NDVI anomaly z=${v.toFixed(2)} (vegetation loss signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "temporal_variance",
        weight: 0.25,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, v / 0.1); // variance > 0.1 = high instability
          return { signal, direction: signal > 0.3 ? "loss" : "neutral" };
        },
        description: (v, s) => `Temporal variance ${v.toFixed(4)} (instability signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "burn_severity",
        weight: 0.30,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.max(0, v) / 0.5); // dNBR > 0.5 = high severity
          return { signal, direction: signal > 0.2 ? "loss" : "neutral" };
        },
        description: (v, s) => `dNBR ${v.toFixed(3)} (burn signal ${(s * 100).toFixed(0)}%)`,
      },
    ],
    threshold: 0.35,
    minEvidenceSources: 2,
    severityFromSignal: (signal, areaHa) => {
      if (signal > 0.65 && areaHa > 10) return "critical";
      if (signal > 0.55 || areaHa > 5) return "high";
      if (signal > 0.42) return "moderate";
      return "low";
    },
  },

  burn_event: {
    type: "burn_event",
    label: "Burn Event",
    description: "Fused detection of burn/fire signature — burn severity + vegetation anomaly. Indicates possible burn or severe vegetation stress.",
    evidenceSources: [
      {
        productType: "burn_severity",
        weight: 0.60,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.max(0, v) / 0.5);
          return { signal, direction: signal > 0.3 ? "loss" : "neutral" };
        },
        description: (v, s) => `dNBR ${v.toFixed(3)} (burn severity signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "vegetation_anomaly",
        weight: 0.40,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.abs(Math.min(0, v)) / 3);
          return { signal, direction: v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `NDVI anomaly z=${v.toFixed(2)} (vegetation loss signal ${(s * 100).toFixed(0)}%)`,
      },
    ],
    threshold: 0.40,
    minEvidenceSources: 2,
    severityFromSignal: (signal, areaHa) => {
      if (signal > 0.6 && areaHa > 5) return "critical";
      if (signal > 0.5 || areaHa > 2) return "high";
      if (signal > 0.42) return "moderate";
      return "low";
    },
  },

  moisture_stress: {
    type: "moisture_stress",
    label: "Moisture Stress",
    description: "Fused detection of moisture deficit — moisture anomaly + vegetation anomaly. Indicates drying conditions or water stress.",
    evidenceSources: [
      {
        productType: "moisture_anomaly",
        weight: 0.55,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.abs(Math.min(0, v)) / 3);
          return { signal, direction: v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `Moisture anomaly z=${v.toFixed(2)} (moisture deficit signal ${(s * 100).toFixed(0)}%)`,
      },
      {
        productType: "vegetation_anomaly",
        weight: 0.45,
        extractSignal: (v) => {
          if (!Number.isFinite(v)) return { signal: 0, direction: "neutral" };
          const signal = Math.min(1, Math.abs(Math.min(0, v)) / 3);
          return { signal, direction: v < -1 ? "loss" : "neutral" };
        },
        description: (v, s) => `NDVI anomaly z=${v.toFixed(2)} (vegetation stress signal ${(s * 100).toFixed(0)}%)`,
      },
    ],
    threshold: 0.40,
    minEvidenceSources: 2,
    severityFromSignal: (signal, areaHa) => {
      if (signal > 0.6 && areaHa > 20) return "critical";
      if (signal > 0.5 || areaHa > 10) return "high";
      if (signal > 0.42) return "moderate";
      return "low";
    },
  },
};

export const OBSERVATION_TYPE_LIST = Object.values(FUSION_RULES);

export interface EvidencePiece {
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

export interface FusedObservation {
  type: ObservationType;
  fusedSignal: number;
  fusedConfidence: number;
  fusedUncertainty: number;
  evidence: EvidencePiece[];
  evidenceCount: number;
  severity: Severity;
}

export interface ObservationRecord {
  id: string;
  uuid: string;
  type: ObservationType;
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
  status: ObservationStatus;
  severity: Severity;
  currentVersion: number;
  sourceProducts: string[];
  sourceModels: string[];
  mgrsTile: string | null;
  sceneId: string | null;
  evidence: EvidencePiece[];
  affectedEntities: { entityId: string; relationship: string; distance: number | null }[];
  createdAt: string;
}
