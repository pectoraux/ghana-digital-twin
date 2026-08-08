// Ghana Digital Twin — Bayesian Hypothesis Engine
// Generates ranked competing hypotheses per observation using deterministic rules
// + Bayesian confidence updates. Supports + contradicts evidence explicitly.
// NOT "AI deciding legality" — principled, auditable reasoning.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { HYPOTHESIS_DEFS, RULES, type HypothesisType, type RuleDef } from "./types";
import { buildEvidenceBundles, listBundles } from "./bundles";
import { emit } from "@/lib/worldmodel/event-bus";

export interface HypothesisResult {
  observationId: string;
  hypothesesCreated: number;
  rulesFired: number;
}

/**
 * Generate competing hypotheses for an observation using Bayesian reasoning.
 * Steps:
 * 1. Build evidence bundles (group evidence by category)
 * 2. For each hypothesis type, start with prior
 * 3. Apply each matching rule: update posterior via likelihood ratio
 * 4. Normalize posteriors across competing hypotheses
 * 5. Rank and persist
 */
export async function generateHypotheses(observationId: string): Promise<HypothesisResult> {
  // 1. build evidence bundles
  const bundles = await buildEvidenceBundles(observationId);
  if (bundles.length === 0) return { observationId, hypothesesCreated: 0, rulesFired: 0 };

  // load observation for context (area, type, affected entities)
  const observation = await db.observation.findUnique({
    where: { id: observationId },
    include: { affectedEntities: true },
  });
  if (!observation) return { observationId, hypothesesCreated: 0, rulesFired: 0 };

  // check for river proximity (from affected entities)
  const hasRiverProximity = observation.affectedEntities.some(
    (a) => a.relationship === "overlaps" || a.relationship === "adjacent_to"
  );

  // 2. for each hypothesis type, compute posterior via Bayesian updates
  const hypothesisStates: HypothesisType[] = Object.keys(HYPOTHESIS_DEFS) as HypothesisType[];
  const posteriors: Record<string, { posterior: number; evidence: any[]; rulesFired: string[] }> = {};

  for (const hType of hypothesisStates) {
    const def = HYPOTHESIS_DEFS[hType];
    let prior = def.prior;
    const evidenceContributions: any[] = [];
    const rulesFired: string[] = [];

    // 3. apply each rule that targets this hypothesis
    for (const rule of RULES.filter((r) => r.hypothesisType === hType)) {
      const matched = matchRule(rule, bundles, hasRiverProximity);
      if (!matched) continue;

      rulesFired.push(rule.ruleId);

      // Bayesian update: posterior_odds = prior_odds × likelihood_ratio
      const priorOdds = prior / (1 - prior);
      const posteriorOdds = priorOdds * rule.likelihoodRatio;
      prior = posteriorOdds / (1 + posteriorOdds);

      evidenceContributions.push({
        ruleId: rule.ruleId,
        ruleName: rule.name,
        relationship: rule.effect === "boost" ? "supports" : "contradicts",
        likelihoodRatio: rule.likelihoodRatio,
        posteriorContribution: Math.log(rule.likelihoodRatio),
        description: rule.description,
        matchedConditions: matched,
      });
    }

    // Also add bundle-level evidence contributions
    for (const bundle of bundles) {
      const contribution = assessBundleForHypothesis(hType, bundle, hasRiverProximity);
      if (contribution) {
        evidenceContributions.push(contribution);
        const priorOdds = prior / (1 - prior);
        const posteriorOdds = priorOdds * contribution.likelihoodRatio;
        prior = posteriorOdds / (1 + posteriorOdds);
      }
    }

    posteriors[hType] = {
      posterior: prior,
      evidence: evidenceContributions,
      rulesFired,
    };
  }

  // 4. normalize posteriors across competing hypotheses (softmax-like)
  const totalPosterior = Object.values(posteriors).reduce((a, p) => a + p.posterior, 0);
  const normalized: Record<string, number> = {};
  for (const [hType, state] of Object.entries(posteriors)) {
    normalized[hType] = totalPosterior > 0 ? state.posterior / totalPosterior : 0;
  }

  // 5. rank by normalized posterior
  const ranked = Object.entries(normalized)
    .sort(([, a], [, b]) => b - a)
    .map(([hType, conf], i) => ({ hType: hType as HypothesisType, confidence: conf, rank: i + 1 }));

  // clear existing hypotheses for this observation
  await db.hypothesis.deleteMany({ where: { observationId } });

  let created = 0;
  let totalRulesFired = 0;

  // persist hypotheses (only those with meaningful confidence > 0.02)
  for (const r of ranked) {
    if (r.confidence < 0.02) continue;
    const def = HYPOTHESIS_DEFS[r.hType];
    const state = posteriors[r.hType];
    totalRulesFired += state.rulesFired.length;

    const supportingEvidence = state.evidence.filter((e: any) => e.relationship === "supports");
    const contradictingEvidence = state.evidence.filter((e: any) => e.relationship === "contradicts");
    const missingEvidence = identifyMissingEvidence(r.hType, bundles);

    const reasoning = buildReasoningChain(r.hType, def, state.evidence, bundles, hasRiverProximity);

    const hyp = await db.hypothesis.create({
      data: {
        uuid: uuidv4(),
        observationId,
        type: r.hType,
        label: def.label,
        description: def.description,
        prior: def.prior,
        posterior: posteriors[r.hType].posterior,
        confidence: r.confidence,
        rank: r.rank,
        isPrimary: r.rank === 1,
        supportingCount: supportingEvidence.length,
        contradictingCount: contradictingEvidence.length,
        missingCount: missingEvidence.length,
        reasoning,
        recommendedVerification: def.recommendedVerification,
        status: "candidate",
        rulesFired: JSON.stringify(state.rulesFired),
      },
    });

    // persist per-evidence contributions
    for (const ev of state.evidence) {
      await db.hypothesisEvidence.create({
        data: {
          hypothesisId: hyp.id,
          evidenceId: null,
          bundleId: null,
          relationship: ev.relationship,
          likelihoodRatio: ev.likelihoodRatio,
          posteriorContribution: ev.posteriorContribution,
          description: ev.description || ev.ruleName,
          weight: Math.abs(ev.posteriorContribution),
        },
      });
    }

    created++;
    emit.entityCreated("intelligence-engine", hyp.id, def.label);
  }

  emit.observationPipelineTriggered("intelligence-engine", created);
  return { observationId, hypothesesCreated: created, rulesFired: totalRulesFired };
}

// ---- Rule matching ----
function matchRule(rule: RuleDef, bundles: any[], hasRiverProximity: boolean): boolean {
  for (const cond of rule.conditions) {
    if (cond.bundle) {
      const bundle = bundles.find((b) => b.category === cond.bundle);
      if (!bundle) return false;
      if (cond.indication) {
        // Fixed matching: check if ANY significant word from the condition
        // appears in the bundle indication (case-insensitive).
        // The old code used split(" ")[0] which broke for multi-word qualifiers
        // like "seasonal water expansion" → "seasonal" (never matched "water expansion").
        const condWords = cond.indication.toLowerCase().split(" ").filter((w) => w.length > 2);
        const bundleInd = bundle.indication.toLowerCase();
        const matches = condWords.some((word) => bundleInd.includes(word));
        if (!matches) return false;
      }
      if (cond.minSignal && bundle.meanSignal < cond.minSignal) return false;
    }
    if (cond.productType) {
      // check if any bundle has evidence
      const hasProduct = bundles.some((b) => {
        try {
          const ids = typeof b.evidenceIds === "string" ? JSON.parse(b.evidenceIds) : b.evidenceIds;
          return Array.isArray(ids) && ids.length > 0;
        } catch {
          return false;
        }
      });
      if (!hasProduct) return false;
    }
  }
  // special: river proximity rules
  if (rule.ruleId === "rule-flood-02" && !hasRiverProximity) return false;
  return true;
}

// ---- Bundle-level evidence assessment ----
function assessBundleForHypothesis(
  hType: HypothesisType,
  bundle: any,
  hasRiverProximity: boolean
): any | null {
  // Mining: vegetation loss + terrain + river proximity
  if (hType === "artisanal_mining" && bundle.category === "vegetation" && bundle.indication.includes("loss") && hasRiverProximity) {
    return {
      ruleId: "bundle-mining-veg",
      ruleName: "Vegetation loss near river",
      relationship: "supports",
      likelihoodRatio: 1.8,
      posteriorContribution: Math.log(1.8),
      description: `Vegetation loss (signal ${(bundle.meanSignal * 100).toFixed(0)}%) near river supports mining hypothesis`,
    };
  }
  // Agriculture: vegetation loss without river
  if (hType === "agricultural_expansion" && bundle.category === "vegetation" && bundle.indication.includes("loss") && !hasRiverProximity) {
    return {
      ruleId: "bundle-agri-veg",
      ruleName: "Vegetation loss without water context",
      relationship: "supports",
      likelihoodRatio: 1.5,
      posteriorContribution: Math.log(1.5),
      description: `Vegetation loss without river proximity favors agriculture over mining`,
    };
  }
  return null;
}

// ---- Missing evidence identification ----
function identifyMissingEvidence(hType: HypothesisType, bundles: any[]): string[] {
  const categories = new Set(bundles.map((b) => b.category));
  const missing: string[] = [];

  if (hType === "artisanal_mining") {
    if (!categories.has("hydrology")) missing.push("Water body change analysis (pit flooding indicator)");
    if (!categories.has("infrastructure")) missing.push("Mining cadastre / permit check");
  }
  if (hType === "road_construction") {
    if (!categories.has("infrastructure")) missing.push("OSM road diff comparison");
  }
  if (hType === "flood_erosion") {
    if (!categories.has("atmospheric")) missing.push("Rainfall data (CHIRPS) for preceding days");
  }
  if (hType === "deforestation") {
    if (!categories.has("vegetation")) missing.push("Forest cover baseline (Hansen GFC)");
  }

  return missing;
}

// ---- Reasoning chain builder ----
function buildReasoningChain(
  hType: HypothesisType,
  def: any,
  evidence: any[],
  bundles: any[],
  hasRiverProximity: boolean
): string {
  const parts: string[] = [];
  parts.push(`Hypothesis: ${def.label}.`);
  parts.push(`Prior probability: ${(def.prior * 100).toFixed(0)}% (base rate).`);

  if (evidence.length > 0) {
    parts.push(`Evidence applied (${evidence.length} pieces):`);
    for (const e of evidence.slice(0, 5)) {
      const lr = e.likelihoodRatio.toFixed(2);
      parts.push(`  • ${e.relationship.toUpperCase()}: ${e.description || e.ruleName} (LR=${lr})`);
    }
  }

  if (bundles.length > 0) {
    parts.push(`Evidence bundles: ${bundles.map((b) => `${b.label} (${b.indication}, ${(b.meanSignal * 100).toFixed(0)}%)`).join("; ")}.`);
  }

  if (hasRiverProximity) {
    parts.push("River proximity detected — relevant for mining and flood hypotheses.");
  }

  parts.push(`Recommended verification: ${def.recommendedVerification}`);
  parts.push("No legal conclusion asserted. This is a ranked hypothesis, not a determination.");

  return parts.join("\n");
}

// ---- Reads ----

export async function getHypotheses(observationId: string): Promise<any[]> {
  const rows = await db.hypothesis.findMany({
    where: { observationId },
    orderBy: { rank: "asc" },
    include: { evidence: true },
  });
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    observationId: r.observationId,
    type: r.type,
    label: r.label,
    description: r.description,
    prior: r.prior,
    posterior: r.posterior,
    confidence: r.confidence,
    rank: r.rank,
    isPrimary: r.isPrimary,
    supportingCount: r.supportingCount,
    contradictingCount: r.contradictingCount,
    missingCount: r.missingCount,
    reasoning: r.reasoning,
    recommendedVerification: r.recommendedVerification,
    status: r.status,
    rulesFired: JSON.parse(r.rulesFired || "[]"),
    evidence: r.evidence.map((e) => ({
      id: e.id,
      relationship: e.relationship,
      likelihoodRatio: e.likelihoodRatio,
      posteriorContribution: e.posteriorContribution,
      description: e.description,
      weight: e.weight,
    })),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

export async function getHypothesis(id: string): Promise<any | null> {
  const row = await db.hypothesis.findUnique({
    where: { id },
    include: { evidence: true, observation: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    observationId: row.observationId,
    type: row.type,
    label: row.label,
    description: row.description,
    prior: row.prior,
    posterior: row.posterior,
    confidence: row.confidence,
    rank: row.rank,
    isPrimary: row.isPrimary,
    supportingCount: row.supportingCount,
    contradictingCount: row.contradictingCount,
    missingCount: row.missingCount,
    reasoning: row.reasoning,
    recommendedVerification: row.recommendedVerification,
    status: row.status,
    rulesFired: JSON.parse(row.rulesFired || "[]"),
    evidence: row.evidence.map((e) => ({
      id: e.id,
      relationship: e.relationship,
      likelihoodRatio: e.likelihoodRatio,
      posteriorContribution: e.posteriorContribution,
      description: e.description,
      weight: e.weight,
    })),
    observation: row.observation ? {
      id: row.observation.id,
      type: row.observation.type,
      title: row.observation.title,
      areaHa: row.observation.areaHa,
    } : null,
  };
}

export async function listAllHypotheses(opts: { type?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.hypothesis.findMany({
    where: opts.type ? { type: opts.type } : {},
    orderBy: { confidence: "desc" },
    take: opts.limit ?? 100,
    include: { observation: { select: { id: true, type: true, title: true, areaHa: true, mgrsTile: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    observationId: r.observationId,
    type: r.type,
    label: r.label,
    confidence: r.confidence,
    rank: r.rank,
    isPrimary: r.isPrimary,
    supportingCount: r.supportingCount,
    contradictingCount: r.contradictingCount,
    missingCount: r.missingCount,
    status: r.status,
    rulesFired: JSON.parse(r.rulesFired || "[]"),
    observation: r.observation,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}
