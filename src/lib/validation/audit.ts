// Ghana Digital Twin — Explainability Audit
// Every hypothesis answers "Why?" AND "Why not?" with structured
// supporting/contradicting/missing evidence. Designed for regulators.

import { db } from "@/lib/db";
import { HYPOTHESIS_DEFS, type HypothesisType } from "@/lib/intelligence/types";

export interface ExplainabilityAudit {
  hypothesisId: string;
  hypothesisType: string;
  hypothesisLabel: string;
  confidence: number;
  uncertainty: number;
  prior: number;
  posterior: number;
  rank: number;
  // structured evidence
  supporting: AuditEvidence[];
  contradicting: AuditEvidence[];
  missing: string[];
  // reasoning
  reasoning: string;
  rulesFired: string[];
  recommendedVerification: string;
  // context
  observation: {
    type: string;
    areaHa: number;
    severity: string;
    observedAt: string;
    mgrsTile: string | null;
  };
  // lineage
  lineageAvailable: boolean;
  groundTruthAvailable: boolean;
  groundTruthOutcome?: string;
}

export interface AuditEvidence {
  source: string;
  description: string;
  weight: number;
  confidence: number;
  likelihoodRatio: number;
}

/**
 * Generate a full explainability audit for a hypothesis.
 * Structured as: Supporting ✓ / Contradicting ✗ / Missing □
 */
export async function generateExplainabilityAudit(hypothesisId: string): Promise<ExplainabilityAudit | null> {
  const hyp = await db.hypothesis.findUnique({
    where: { id: hypothesisId },
    include: {
      evidence: true,
      observation: {
        select: {
          id: true, type: true, areaHa: true, severity: true,
          observedAt: true, mgrsTile: true, confidence: true,
        },
      },
    },
  });

  if (!hyp) return null;

  // get ground truth (if any)
  const groundTruth = await db.groundTruth.findFirst({
    where: { hypothesisId },
    orderBy: { createdAt: "desc" },
  });

  // get evidence bundles for the observation
  const bundles = await db.evidenceBundle.findMany({
    where: { observationId: hyp.observationId },
  });

  // check lineage availability
  const evidenceLinks = await db.observationEvidenceLink.findFirst({
    where: { observationId: hyp.observationId },
  });

  // classify evidence into supporting / contradicting
  const supporting: AuditEvidence[] = [];
  const contradicting: AuditEvidence[] = [];

  for (const ev of hyp.evidence) {
    const auditEv: AuditEvidence = {
      source: ev.description?.split(":")[0]?.trim() || "rule",
      description: ev.description || "",
      weight: ev.weight,
      confidence: 0.8, // default
      likelihoodRatio: ev.likelihoodRatio,
    };

    if (ev.relationship === "supports") {
      supporting.push(auditEv);
    } else if (ev.relationship === "contradicts") {
      contradicting.push(auditEv);
    }
  }

  // also classify evidence bundles
  for (const bundle of bundles) {
    const isSupporting = isBundleSupporting(hyp.type as HypothesisType, bundle.category, bundle.indication);
    const auditEv: AuditEvidence = {
      source: bundle.label,
      description: `${bundle.indication} (${(bundle.meanSignal * 100).toFixed(0)}% signal, ${bundle.evidenceCount} evidence objects)`,
      weight: bundle.meanSignal,
      confidence: bundle.meanConfidence,
      likelihoodRatio: isSupporting ? 1.5 : 0.7,
    };

    if (isSupporting) {
      supporting.push(auditEv);
    } else {
      contradicting.push(auditEv);
    }
  }

  // identify missing evidence
  const missing = identifyMissingEvidenceForAudit(hyp.type as HypothesisType, bundles);

  const def = HYPOTHESIS_DEFS[hyp.type as HypothesisType];

  return {
    hypothesisId: hyp.id,
    hypothesisType: hyp.type,
    hypothesisLabel: hyp.label,
    confidence: hyp.confidence,
    uncertainty: 1 - hyp.confidence,
    prior: hyp.prior,
    posterior: hyp.posterior,
    rank: hyp.rank,
    supporting,
    contradicting,
    missing,
    reasoning: hyp.reasoning,
    rulesFired: JSON.parse(hyp.rulesFired || "[]"),
    recommendedVerification: hyp.recommendedVerification || def?.recommendedVerification || "",
    observation: {
      type: hyp.observation?.type ?? "",
      areaHa: hyp.observation?.areaHa ?? 0,
      severity: hyp.observation?.severity ?? "",
      observedAt: hyp.observation?.observedAt instanceof Date ? hyp.observation.observedAt.toISOString() : (hyp.observation?.observedAt as string) ?? "",
      mgrsTile: hyp.observation?.mgrsTile ?? null,
    },
    lineageAvailable: !!evidenceLinks,
    groundTruthAvailable: !!groundTruth,
    groundTruthOutcome: groundTruth?.verifiedOutcome,
  };
}

function isBundleSupporting(hypothesisType: HypothesisType, category: string, indication: string): boolean {
  // Mining: vegetation loss + bare soil + water change = supporting
  if (hypothesisType === "artisanal_mining") {
    if (category === "vegetation" && indication.includes("loss")) return true;
    if (category === "terrain" && indication.includes("bare soil")) return true;
    if (category === "hydrology" && indication.includes("water")) return true;
    return false;
  }
  // Agriculture: vegetation loss without water = supporting
  if (hypothesisType === "agricultural_expansion") {
    if (category === "vegetation" && indication.includes("loss")) return true;
    return false;
  }
  // Deforestation: vegetation loss + burn = supporting
  if (hypothesisType === "deforestation") {
    if (category === "vegetation" && indication.includes("loss")) return true;
    if (indication.includes("burn")) return true;
    return false;
  }
  // Default: vegetation loss is supporting for most change hypotheses
  if (indication.includes("loss") || indication.includes("increase") || indication.includes("disturbance")) {
    return true;
  }
  return false;
}

function identifyMissingEvidenceForAudit(hypothesisType: HypothesisType, bundles: any[]): string[] {
  const categories = new Set(bundles.map((b) => b.category));
  const missing: string[] = [];

  if (hypothesisType === "artisanal_mining") {
    if (!categories.has("sar")) missing.push("SAR imagery (surface disturbance through clouds)");
    if (!categories.has("hydrology")) missing.push("Water body change analysis (pit flooding indicator)");
    if (!categories.has("infrastructure")) missing.push("Mining cadastre / permit verification");
    missing.push("Community confirmation of mining activity");
    missing.push("Drone imagery for pit geometry verification");
  } else if (hypothesisType === "road_construction") {
    if (!categories.has("infrastructure")) missing.push("OSM road diff comparison");
    missing.push("Government infrastructure plan verification");
  } else if (hypothesisType === "flood_erosion") {
    if (!categories.has("atmospheric")) missing.push("Rainfall data (CHIRPS) for preceding days");
    missing.push("River flow sensor data");
    missing.push("Community flood reports");
  } else if (hypothesisType === "deforestation") {
    if (!categories.has("vegetation")) missing.push("Forest cover baseline (Hansen GFC)");
    missing.push("VIIRS active fire data");
    missing.push("Drone canopy assessment");
  } else if (hypothesisType === "agricultural_expansion") {
    missing.push("Land cover baseline (ESA WorldCover)");
    missing.push("Community confirmation of farming activity");
  }

  return missing;
}
