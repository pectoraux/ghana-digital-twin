// Ghana Digital Twin — Multi-Modal Evidence Fusion
// Combines evidence from ALL available sensing modalities into a unified evidence space.
// Instead of "NDVI dropped", the platform can say:
// "NDVI dropped, SAR indicates fresh surface disturbance, rainfall was below seasonal norms,
// no flooding occurred, therefore vegetation loss is unlikely to be seasonal."

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export interface MultiModalEvidence {
  modality: string;
  feature: string;
  value: number;
  signal: number; // 0..1 normalized
  direction: "loss" | "gain" | "neutral";
  confidence: number;
  description: string;
}

export interface FusedMultiModalAssessment {
  tileId: string;
  evidence: MultiModalEvidence[];
  fusedSignal: number;
  fusedConfidence: number;
  modalityCount: number;
  assessment: string;
  crossModalAgreement: number; // 0..1
}

/**
 * Fuse multi-modal evidence for a grid tile.
 * Collects features from ALL modalities and produces a unified assessment.
 */
export async function fuseMultiModalEvidence(tileId: string): Promise<FusedMultiModalAssessment | null> {
  const feature = await db.featureVector.findFirst({
    where: { tileId },
    orderBy: { computedAt: "desc" },
  });
  if (!feature) return null;

  const evidence: MultiModalEvidence[] = [];

  // 1. Optical evidence
  if (feature.ndvi != null) {
    const signal = Math.max(0, Math.min(1, (0.5 - feature.ndvi) / 0.5));
    evidence.push({
      modality: "sentinel-2-optical",
      feature: "ndvi",
      value: feature.ndvi,
      signal,
      direction: feature.ndvi < 0.3 ? "loss" : "neutral",
      confidence: 1 - (feature.cloudCover ?? 0) / 100,
      description: `NDVI = ${feature.ndvi.toFixed(3)} (vegetation ${feature.ndvi < 0.3 ? "loss" : "stable"})`,
    });
  }
  if (feature.bsi != null) {
    const signal = Math.max(0, (feature.bsi - 0.4) / 0.6);
    evidence.push({
      modality: "sentinel-2-optical",
      feature: "bsi",
      value: feature.bsi,
      signal,
      direction: feature.bsi > 0.5 ? "gain" : "neutral",
      confidence: 1 - (feature.cloudCover ?? 0) / 100,
      description: `Bare soil index = ${feature.bsi.toFixed(3)} (${feature.bsi > 0.5 ? "exposed" : "covered"})`,
    });
  }
  if (feature.ndwi != null) {
    const signal = Math.abs(feature.ndwi) > 0.3 ? 1 : Math.abs(feature.ndwi) / 0.3;
    evidence.push({
      modality: "sentinel-2-optical",
      feature: "ndwi",
      value: feature.ndwi,
      signal,
      direction: feature.ndwi > 0.3 ? "gain" : feature.ndwi < -0.3 ? "loss" : "neutral",
      confidence: 1 - (feature.cloudCover ?? 0) / 100,
      description: `NDWI = ${feature.ndwi.toFixed(3)} (water ${feature.ndwi > 0.3 ? "expansion" : feature.ndwi < -0.3 ? "loss" : "stable"})`,
    });
  }

  // 2. SAR evidence (if available)
  if (feature.sarBackscatter != null) {
    const signal = Math.max(0, Math.min(1, Math.abs(feature.sarBackscatter + 10) / 15));
    evidence.push({
      modality: "sentinel-1-sar",
      feature: "sarBackscatter",
      value: feature.sarBackscatter,
      signal,
      direction: feature.sarBackscatter > -5 ? "gain" : "neutral",
      confidence: 0.9, // SAR is cloud-independent
      description: `SAR backscatter = ${feature.sarBackscatter.toFixed(1)} dB (${feature.sarBackscatter > -5 ? "surface disturbance detected" : "stable surface"})`,
    });
  }
  if (feature.sarCoherence != null) {
    const signal = feature.sarCoherence < 0.5 ? 1 : 0;
    evidence.push({
      modality: "sentinel-1-sar",
      feature: "sarCoherence",
      value: feature.sarCoherence,
      signal,
      direction: feature.sarCoherence < 0.5 ? "loss" : "neutral",
      confidence: 0.9,
      description: `SAR coherence = ${feature.sarCoherence.toFixed(2)} (${feature.sarCoherence < 0.5 ? "surface change detected" : "stable"})`,
    });
  }

  // 3. Weather evidence (contextual — explains false positives)
  if (feature.rainfall7d != null) {
    const heavyRain = feature.rainfall7d > 50;
    evidence.push({
      modality: "chirps-weather",
      feature: "rainfall7d",
      value: feature.rainfall7d,
      signal: heavyRain ? 0.3 : 0, // heavy rain explains water changes
      direction: heavyRain ? "gain" : "neutral",
      confidence: 0.95,
      description: `7-day rainfall = ${feature.rainfall7d.toFixed(0)}mm (${heavyRain ? "heavy — water changes may be seasonal" : "low — changes likely anthropogenic"})`,
    });
  }
  if (feature.rainfallAnomaly != null) {
    evidence.push({
      modality: "chirps-weather",
      feature: "rainfallAnomaly",
      value: feature.rainfallAnomaly,
      signal: Math.abs(feature.rainfallAnomaly) > 20 ? 0.3 : 0,
      direction: feature.rainfallAnomaly > 20 ? "gain" : feature.rainfallAnomaly < -20 ? "loss" : "neutral",
      confidence: 0.9,
      description: `Rainfall anomaly = ${feature.rainfallAnomaly.toFixed(0)}% (${feature.rainfallAnomaly > 20 ? "wetter than normal" : feature.rainfallAnomaly < -20 ? "drier than normal" : "normal"})`,
    });
  }

  // 4. Terrain evidence
  if (feature.slope != null) {
    const steepSlope = feature.slope > 10;
    evidence.push({
      modality: "srtm-dem",
      feature: "slope",
      value: feature.slope,
      signal: steepSlope ? 0.4 : 0,
      direction: "neutral",
      confidence: 1.0,
      description: `Slope = ${feature.slope.toFixed(1)}° (${steepSlope ? "erosion-susceptible" : "flat"})`,
    });
  }
  if (feature.erosionSusceptibility != null) {
    evidence.push({
      modality: "srtm-dem",
      feature: "erosionSusceptibility",
      value: feature.erosionSusceptibility,
      signal: feature.erosionSusceptibility,
      direction: feature.erosionSusceptibility > 0.5 ? "loss" : "neutral",
      confidence: 0.85,
      description: `Erosion susceptibility = ${(feature.erosionSusceptibility * 100).toFixed(0)}%`,
    });
  }

  // 5. Hydrology evidence
  if (feature.distanceToRiver != null) {
    const near = feature.distanceToRiver < 2;
    evidence.push({
      modality: "hydrosheds-hydrology",
      feature: "distanceToRiver",
      value: feature.distanceToRiver,
      signal: near ? 0.6 : 0,
      direction: near ? "gain" : "neutral",
      confidence: 1.0,
      description: `Distance to river = ${feature.distanceToRiver.toFixed(1)}km (${near ? "riparian zone — high impact risk" : "not near river"})`,
    });
  }

  // 6. Human activity evidence
  if (feature.nightLights != null) {
    const growth = feature.nightLights > 0.3;
    evidence.push({
      modality: "nightlights-human",
      feature: "nightLights",
      value: feature.nightLights,
      signal: growth ? 0.4 : 0,
      direction: growth ? "gain" : "neutral",
      confidence: 0.8,
      description: `Night lights = ${feature.nightLights.toFixed(2)} (${growth ? "settlement/industrial activity detected" : "rural"})`,
    });
  }
  if (feature.builtUpIndex != null) {
    evidence.push({
      modality: "nightlights-human",
      feature: "builtUpIndex",
      value: feature.builtUpIndex,
      signal: feature.builtUpIndex > 0.3 ? feature.builtUpIndex : 0,
      direction: feature.builtUpIndex > 0.3 ? "gain" : "neutral",
      confidence: 0.8,
      description: `Built-up index = ${feature.builtUpIndex.toFixed(2)} (${feature.builtUpIndex > 0.3 ? "urban expansion" : "rural"})`,
    });
  }

  if (evidence.length === 0) return null;

  // fuse: weighted average by confidence
  const totalWeight = evidence.reduce((a, e) => a + e.confidence, 0);
  const fusedSignal = evidence.reduce((a, e) => a + e.signal * e.confidence, 0) / totalWeight;
  const fusedConfidence = totalWeight / evidence.length;

  // cross-modal agreement: do multiple modalities agree on the signal direction?
  const lossVotes = evidence.filter((e) => e.direction === "loss").length;
  const gainVotes = evidence.filter((e) => e.direction === "gain").length;
  const maxVotes = Math.max(lossVotes, gainVotes);
  const crossModalAgreement = evidence.length > 0 ? maxVotes / evidence.length : 0;

  // generate assessment text
  const modalities = new Set(evidence.map((e) => e.modality));
  const disturbanceEvidence = evidence.filter((e) => e.signal > 0.3 && (e.direction === "loss" || e.direction === "gain"));
  const weatherContext = evidence.find((e) => e.modality === "chirps-weather");

  let assessment: string;
  if (disturbanceEvidence.length >= 3) {
    assessment = `Multi-modal disturbance detected across ${modalities.size} modalities. ${disturbanceEvidence.length} evidence sources show significant change.`;
    if (weatherContext && weatherContext.value > 50) {
      assessment += ` However, heavy rainfall (${weatherContext.value.toFixed(0)}mm) may explain water-related changes.`;
    } else {
      assessment += ` Low rainfall confirms changes are likely anthropogenic, not seasonal.`;
    }
  } else if (disturbanceEvidence.length >= 1) {
    assessment = `Partial disturbance signal from ${disturbanceEvidence.length} modality(ies). Cross-modal agreement: ${(crossModalAgreement * 100).toFixed(0)}%.`;
  } else {
    assessment = `No significant disturbance detected. All modalities indicate stable conditions across ${modalities.size} sensing modalities.`;
  }

  return {
    tileId,
    evidence,
    fusedSignal,
    fusedConfidence,
    modalityCount: modalities.size,
    assessment,
    crossModalAgreement,
  };
}

export async function getMultiModalStats(): Promise<any> {
  const [features, tiles, avgCompleteness] = await Promise.all([
    db.featureVector.count(),
    db.featureVector.groupBy({ by: ["tileId"] }).then((r) => r.length),
    db.featureVector.aggregate({ _avg: { dataCompleteness: true } }),
  ]);

  // count which modalities have data
  const sample = await db.featureVector.findFirst({ orderBy: { computedAt: "desc" } });
  const modalityCoverage: Record<string, boolean> = {};
  if (sample) {
    modalityCoverage.optical = sample.ndvi != null;
    modalityCoverage.sar = sample.sarBackscatter != null;
    modalityCoverage.thermal = sample.thermalAnomaly != null;
    modalityCoverage.weather = sample.rainfall7d != null;
    modalityCoverage.dem = sample.elevation != null;
    modalityCoverage.hydrology = sample.distanceToRiver != null;
    modalityCoverage.human_activity = sample.nightLights != null;
  }

  return {
    featureVectors: features,
    tilesWithFeatures: tiles,
    avgDataCompleteness: avgCompleteness._avg.dataCompleteness ?? 0,
    modalitiesActive: Object.values(modalityCoverage).filter(Boolean).length,
    modalityCoverage,
  };
}
