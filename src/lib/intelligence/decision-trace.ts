// Ghana Digital Twin — Decision Trace
// Every hypothesis answers "why?" with a full auditable chain:
// Hypothesis → Evidence → Observation → Phenomenon → Raster → Satellite

import { db } from "@/lib/db";

export interface DecisionTraceNode {
  level: string;
  id: string;
  label: string;
  type: string;
  details: Record<string, any>;
  children?: DecisionTraceNode[];
}

export async function buildDecisionTrace(hypothesisId: string): Promise<DecisionTraceNode | null> {
  const hyp = await db.hypothesis.findUnique({
    where: { id: hypothesisId },
    include: {
      evidence: true,
      observation: {
        include: {
          bundles: true,
          phenomena: { include: { phenomenon: true } },
        },
      },
    },
  });
  if (!hyp) return null;

  const obs = hyp.observation;

  // evidence children (from hypothesis evidence)
  const evidenceChildren: DecisionTraceNode[] = hyp.evidence.map((e) => ({
    level: "hypothesis_evidence",
    id: e.id,
    label: `${e.relationship}: ${e.description?.slice(0, 60) ?? "evidence"}`,
    type: e.relationship,
    details: {
      relationship: e.relationship,
      likelihoodRatio: e.likelihoodRatio,
      posteriorContribution: e.posteriorContribution,
      weight: e.weight,
      description: e.description,
    },
  }));

  // evidence bundles (from observation)
  const bundleChildren: DecisionTraceNode[] = obs.bundles.map((b) => ({
    level: "evidence_bundle",
    id: b.id,
    label: `${b.label}: ${b.indication} (${(b.meanSignal * 100).toFixed(0)}% signal)`,
    type: b.category,
    details: {
      category: b.category,
      indication: b.indication,
      evidenceCount: b.evidenceCount,
      meanSignal: b.meanSignal,
      meanConfidence: b.meanConfidence,
      fusedUncertainty: b.fusedUncertainty,
    },
  }));

  // phenomenon (if linked)
  const phenomenonChildren: DecisionTraceNode[] = obs.phenomena.map((p) => ({
    level: "phenomenon",
    id: p.phenomenon.id,
    label: `${p.phenomenon.type.replace(/_/g, " ")} (${p.phenomenon.observationCount} observations, ${p.phenomenon.durationDays.toFixed(0)}d)`,
    type: p.phenomenon.type,
    details: {
      uuid: p.phenomenon.uuid,
      status: p.phenomenon.status,
      currentAreaHa: p.phenomenon.currentAreaHa,
      growthRateHaPerWeek: p.phenomenon.growthRateHaPerWeek,
      persistenceScore: p.phenomenon.persistenceScore,
      durationDays: p.phenomenon.durationDays,
    },
  }));

  return {
    level: "hypothesis",
    id: hyp.id,
    label: `${hyp.label} (${(hyp.confidence * 100).toFixed(0)}% confidence, rank #${hyp.rank})`,
    type: hyp.type,
    details: {
      uuid: hyp.uuid,
      prior: hyp.prior,
      posterior: hyp.posterior,
      confidence: hyp.confidence,
      rank: hyp.rank,
      supportingCount: hyp.supportingCount,
      contradictingCount: hyp.contradictingCount,
      missingCount: hyp.missingCount,
      rulesFired: JSON.parse(hyp.rulesFired || "[]"),
      reasoning: hyp.reasoning,
      recommendedVerification: hyp.recommendedVerification,
    },
    children: [
      {
        level: "observation",
        id: obs.id,
        label: `${obs.type.replace(/_/g, " ")} (${(obs.confidence * 100).toFixed(0)}% conf, ${obs.areaHa.toFixed(1)} ha)`,
        type: obs.type,
        details: {
          uuid: obs.uuid,
          title: obs.title,
          confidence: obs.confidence,
          uncertainty: obs.uncertainty,
          severity: obs.severity,
          areaHa: obs.areaHa,
          observedAt: obs.observedAt instanceof Date ? obs.observedAt.toISOString() : obs.observedAt,
          evidenceCount: obs.evidenceLinks?.length ?? 0,
        },
        children: [
          ...evidenceChildren,
          ...bundleChildren,
          ...phenomenonChildren,
        ],
      },
    ],
  };
}
