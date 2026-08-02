// Ghana Digital Twin — Explainability Report Generator
// Generates exportable audit documents per observation: full reasoning chain
// from observation → evidence → products → baselines → scenes → COGs,
// plus Bayesian reasoning, rules fired, ground truth, and confidence evolution.

import { db } from "@/lib/db";
import { buildObservationLineage } from "@/lib/temporal/lineage";
import { buildDecisionTrace } from "@/lib/intelligence/decision-trace";

export interface ExplainabilityReport {
  reportId: string;
  generatedAt: string;
  observation: {
    id: string;
    uuid: string;
    type: string;
    title: string;
    summary: string;
    confidence: number;
    uncertainty: number;
    severity: string;
    areaHa: number;
    observedAt: string;
    firstObserved: string;
    lastUpdated: string;
    currentVersion: number;
    mgrsTile: string | null;
    centroid: [number, number];
  };
  evidenceBundles: any[];
  hypotheses: {
    type: string;
    label: string;
    confidence: number;
    rank: number;
    isPrimary: boolean;
    prior: number;
    posterior: number;
    supportingCount: number;
    contradictingCount: number;
    missingCount: number;
    rulesFired: string[];
    reasoning: string;
    recommendedVerification: string;
    evidence: any[];
  }[];
  lineage: any;
  decisionTrace: any;
  groundTruth: any | null;
  confidenceEvolution: any[];
  versionHistory: any[];
  affectedEntities: any[];
  phenomena: any[];
  auditTrail: string;
}

export async function generateReport(observationId: string): Promise<ExplainabilityReport | null> {
  const obs = await db.observation.findUnique({
    where: { id: observationId },
    include: {
      bundles: true,
      hypotheses: { include: { evidence: true }, orderBy: { rank: "asc" } },
      affectedEntities: true,
      phenomena: { include: { phenomenon: true } },
      versions: { orderBy: { version: "asc" } },
    },
  });
  if (!obs) return null;

  // ground truth (if any)
  const groundTruth = await db.groundTruth.findFirst({
    where: { observationId },
    orderBy: { createdAt: "desc" },
  });

  // lineage + decision trace (for primary hypothesis)
  const lineage = await buildObservationLineage(observationId);
  const primaryHyp = obs.hypotheses.find((h) => h.isPrimary) ?? obs.hypotheses[0];
  const decisionTrace = primaryHyp ? await buildDecisionTrace(primaryHyp.id) : null;

  // confidence evolution (from version history + hypotheses)
  const confidenceEvolution = obs.versions.map((v) => ({
    version: v.version,
    confidence: v.confidence,
    uncertainty: v.uncertainty,
    observedAt: v.observedAt instanceof Date ? v.observedAt.toISOString() : v.observedAt,
    change: v.change,
  }));

  // audit trail (human-readable)
  const auditTrail = [
    `Observation ${obs.uuid} created at ${obs.createdAt.toISOString()}`,
    `Type: ${obs.type}, Severity: ${obs.severity}, Area: ${obs.areaHa.toFixed(1)} ha`,
    `Current version: v${obs.currentVersion} (${obs.versions.length} versions total)`,
    `Evidence bundles: ${obs.bundles.length} (${obs.bundles.map((b) => b.category).join(", ")})`,
    `Hypotheses: ${obs.hypotheses.length} (primary: ${primaryHyp?.label ?? "none"})`,
    `Primary hypothesis confidence: ${primaryHyp ? (primaryHyp.confidence * 100).toFixed(0) + "%" : "—"}`,
    `Affected entities: ${obs.affectedEntities.length}`,
    `Linked phenomena: ${obs.phenomena.length}`,
    groundTruth ? `Ground truth: ${groundTruth.verifiedOutcome} (${groundTruth.verificationMethod})` : "Ground truth: not yet verified",
    `Report generated at ${new Date().toISOString()}`,
  ].join("\n");

  return {
    reportId: `rpt-${obs.uuid.slice(0, 8)}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    observation: {
      id: obs.id,
      uuid: obs.uuid,
      type: obs.type,
      title: obs.title,
      summary: obs.summary,
      confidence: obs.confidence,
      uncertainty: obs.uncertainty,
      severity: obs.severity,
      areaHa: obs.areaHa,
      observedAt: obs.observedAt instanceof Date ? obs.observedAt.toISOString() : obs.observedAt,
      firstObserved: obs.firstObserved instanceof Date ? obs.firstObserved.toISOString() : obs.firstObserved,
      lastUpdated: obs.lastUpdated instanceof Date ? obs.lastUpdated.toISOString() : obs.lastUpdated,
      currentVersion: obs.currentVersion,
      mgrsTile: obs.mgrsTile,
      centroid: [obs.centroidLng, obs.centroidLat],
    },
    evidenceBundles: obs.bundles.map((b) => ({
      category: b.category,
      label: b.label,
      evidenceCount: b.evidenceCount,
      meanSignal: b.meanSignal,
      indication: b.indication,
    })),
    hypotheses: obs.hypotheses.map((h) => ({
      type: h.type,
      label: h.label,
      confidence: h.confidence,
      rank: h.rank,
      isPrimary: h.isPrimary,
      prior: h.prior,
      posterior: h.posterior,
      supportingCount: h.supportingCount,
      contradictingCount: h.contradictingCount,
      missingCount: h.missingCount,
      rulesFired: JSON.parse(h.rulesFired || "[]"),
      reasoning: h.reasoning,
      recommendedVerification: h.recommendedVerification,
      evidence: h.evidence.map((e) => ({
        relationship: e.relationship,
        likelihoodRatio: e.likelihoodRatio,
        description: e.description,
      })),
    })),
    lineage,
    decisionTrace,
    groundTruth: groundTruth ? {
      verifiedOutcome: groundTruth.verifiedOutcome,
      verificationMethod: groundTruth.verificationMethod,
      verifiedBy: groundTruth.verifiedBy,
      verifierRole: groundTruth.verifierRole,
      evidenceSummary: groundTruth.evidenceSummary,
      createdAt: groundTruth.createdAt instanceof Date ? groundTruth.createdAt.toISOString() : groundTruth.createdAt,
    } : null,
    confidenceEvolution,
    versionHistory: obs.versions.map((v) => ({
      version: v.version,
      change: v.change,
      confidence: v.confidence,
      observedAt: v.observedAt instanceof Date ? v.observedAt.toISOString() : v.observedAt,
    })),
    affectedEntities: obs.affectedEntities.map((a) => ({
      entityId: a.entityId,
      relationship: a.relationship,
      distance: a.distance,
    })),
    phenomena: obs.phenomena.map((p) => ({
      phenomenonId: p.phenomenon.id,
      type: p.phenomenon.type,
      status: p.phenomenon.status,
      sequence: p.sequence,
    })),
    auditTrail,
  };
}
