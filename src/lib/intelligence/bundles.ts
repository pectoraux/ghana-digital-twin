// Ghana Digital Twin — Evidence Bundle Builder
// Groups standalone evidence by category (vegetation, hydrology, infrastructure,
// terrain, atmospheric) per observation. Observations explain WHICH CATEGORY of
// evidence supports them, not just individual pieces.

import { db } from "@/lib/db";
import type { BundleCategory } from "./types";

const PRODUCT_TO_CATEGORY: Record<string, BundleCategory> = {
  vegetation_anomaly: "vegetation",
  burn_severity: "vegetation",
  temporal_variance: "vegetation",
  cloud_free_composite: "vegetation",
  water_anomaly: "hydrology",
  moisture_anomaly: "hydrology",
  bare_soil: "terrain",
  change_probability: "terrain",
};

const CATEGORY_LABELS: Record<BundleCategory, string> = {
  vegetation: "Vegetation Evidence",
  hydrology: "Hydrology Evidence",
  infrastructure: "Infrastructure Evidence",
  terrain: "Terrain Evidence",
  atmospheric: "Atmospheric Evidence",
};

function deriveIndication(productType: string, direction: string, value: number): string {
  if (productType === "vegetation_anomaly") return value < 0 ? "vegetation loss" : "vegetation gain";
  if (productType === "water_anomaly") return value < 0 ? "water loss" : "water expansion";
  if (productType === "bare_soil") return value > 0.5 ? "bare soil increase" : "bare soil";
  if (productType === "change_probability") return "surface disturbance";
  if (productType === "burn_severity") return value > 0.3 ? "burn signature" : "burn signal";
  if (productType === "moisture_anomaly") return value < 0 ? "moisture deficit" : "moisture increase";
  if (productType === "temporal_variance") return "temporal instability";
  return "anomaly";
}

/**
 * Build evidence bundles for an observation by grouping its linked evidence
 * by category. Each bundle aggregates signal, confidence, and uncertainty.
 */
export async function buildEvidenceBundles(observationId: string): Promise<any[]> {
  // load the observation's linked evidence
  const links = await db.observationEvidenceLink.findMany({
    where: { observationId },
    include: { evidence: true },
  });

  if (links.length === 0) {
    // fallback: use old embedded evidence
    const oldEvidence = await db.observationEvidence.findMany({ where: { observationId } });
    for (const e of oldEvidence) {
      const cat = PRODUCT_TO_CATEGORY[e.productType] ?? "terrain";
      const indication = deriveIndication(e.productType, "neutral", e.value);
      await upsertBundle(observationId, cat, e.value, e.confidence, e.uncertainty, e.description, null);
    }
    return listBundles(observationId);
  }

  // group by category
  const byCategory: Record<string, any[]> = {};
  for (const link of links) {
    const ev = link.evidence;
    const cat = PRODUCT_TO_CATEGORY[ev.productType] ?? "terrain";
    (byCategory[cat] ??= []).push(ev);
  }

  // create/update bundles
  for (const [category, evidence] of Object.entries(byCategory)) {
    const signals = evidence.map((e) => e.normalizedSignal);
    const confidences = evidence.map((e) => e.confidence);
    const uncertainties = evidence.map((e) => e.uncertainty);
    const meanSignal = signals.reduce((a: number, b: number) => a + b, 0) / signals.length;
    const meanConf = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
    const fusedUnc = Math.sqrt(uncertainties.reduce((a: number, b: number) => a + b * b, 0) / uncertainties.length);
    const indication = deriveIndication(evidence[0].productType, evidence[0].direction, evidence[0].value);
    const evidenceIds = evidence.map((e) => e.id);

    await db.evidenceBundle.upsert({
      where: { observationId_category: { observationId, category } },
      update: {
        evidenceCount: evidence.length,
        meanSignal,
        meanConfidence: meanConf,
        fusedUncertainty: fusedUnc,
        indication,
        evidenceIds: JSON.stringify(evidenceIds),
      },
      create: {
        observationId,
        category,
        label: CATEGORY_LABELS[category as BundleCategory] ?? category,
        evidenceCount: evidence.length,
        meanSignal,
        meanConfidence: meanConf,
        fusedUncertainty: fusedUnc,
        indication,
        evidenceIds: JSON.stringify(evidenceIds),
      },
    });
  }

  return listBundles(observationId);
}

async function upsertBundle(
  observationId: string,
  category: string,
  signal: number,
  confidence: number,
  uncertainty: number,
  indication: string,
  evidenceId: string | null
) {
  await db.evidenceBundle.upsert({
    where: { observationId_category: { observationId, category } },
    update: {
      evidenceCount: { increment: 1 },
      meanSignal: signal,
      meanConfidence: confidence,
      fusedUncertainty: uncertainty,
      indication,
    },
    create: {
      observationId,
      category,
      label: CATEGORY_LABELS[category as BundleCategory] ?? category,
      evidenceCount: 1,
      meanSignal: signal,
      meanConfidence: confidence,
      fusedUncertainty: uncertainty,
      indication,
      evidenceIds: JSON.stringify(evidenceId ? [evidenceId] : []),
    },
  });
}

export async function listBundles(observationId: string): Promise<any[]> {
  const rows = await db.evidenceBundle.findMany({
    where: { observationId },
    orderBy: { meanSignal: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    observationId: r.observationId,
    category: r.category,
    label: r.label,
    evidenceCount: r.evidenceCount,
    meanSignal: r.meanSignal,
    meanConfidence: r.meanConfidence,
    fusedUncertainty: r.fusedUncertainty,
    indication: r.indication,
    evidenceIds: JSON.parse(r.evidenceIds || "[]"),
  }));
}
