// Ghana Digital Twin — Learning Engine
// Takes feedback (confirmed/rejected outcomes) and updates Bayesian priors,
// evidence weights, and thresholds. Every confirmed event improves future reasoning.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { HYPOTHESIS_DEFS, type HypothesisType } from "@/lib/intelligence/types";
import { emit } from "@/lib/worldmodel/event-bus";

export interface FeedbackInput {
  observationId?: string;
  hypothesisId?: string;
  phenomenonId?: string;
  outcome: "confirmed" | "rejected" | "needs_monitoring" | "partial";
  feedbackType: "human_inspector" | "government" | "community" | "ground_truth" | "auto_validation";
  hypothesisType?: string;
  notes?: string;
  providerId?: string;
  providerRole?: string;
  credibility?: number;
}

export interface LearningResult {
  feedbackApplied: number;
  priorsUpdated: number;
  updates: { hypothesisType: string; oldPrior: number; newPrior: number; deltaPct: number; accuracy: number }[];
}

/**
 * Submit feedback for an observation/hypothesis.
 */
export async function submitFeedback(input: FeedbackInput): Promise<{ feedbackId: string }> {
  const record = await db.feedbackRecord.create({
    data: {
      observationId: input.observationId ?? null,
      hypothesisId: input.hypothesisId ?? null,
      phenomenonId: input.phenomenonId ?? null,
      outcome: input.outcome,
      feedbackType: input.feedbackType,
      hypothesisType: input.hypothesisType ?? null,
      notes: input.notes ?? null,
      evidence: JSON.stringify({}),
      providerId: input.providerId ?? null,
      providerRole: input.providerRole ?? null,
      credibility: input.credibility ?? 0.8,
    },
  });
  emit.entityCreated("learning-engine", record.id, `Feedback: ${input.outcome}`);
  return { feedbackId: record.id };
}

/**
 * Run the learning engine: process all feedback and update priors.
 * For each hypothesis type:
 *   - Count confirmations and rejections
 *   - Compute running accuracy
 *   - Adjust the learned prior: if confirmed more than expected → increase prior
 *   - If rejected more than expected → decrease prior
 */
export async function runLearning(): Promise<LearningResult> {
  // ensure learned priors exist for all hypothesis types
  await ensureLearnedPriors();

  // get all feedback grouped by hypothesis type
  const feedback = await db.feedbackRecord.findMany({
    where: { hypothesisType: { not: null } },
  });

  const byHypothesis: Record<string, typeof feedback> = {};
  for (const f of feedback) {
    if (f.hypothesisType) {
      (byHypothesis[f.hypothesisType] ??= []).push(f);
    }
  }

  const updates: LearningResult["updates"] = [];
  let priorsUpdated = 0;

  for (const [hType, records] of Object.entries(byHypothesis)) {
    const def = HYPOTHESIS_DEFS[hType as HypothesisType];
    if (!def) continue;

    const confirmed = records.filter((r) => r.outcome === "confirmed").length;
    const rejected = records.filter((r) => r.outcome === "rejected").length;
    const total = confirmed + rejected;
    if (total === 0) continue;

    const accuracy = confirmed / total;

    // get current learned prior
    const prior = await db.learnedPrior.findUnique({ where: { hypothesisType: hType } });
    if (!prior) continue;

    const oldPrior = prior.learnedPrior;

    // Bayesian-inspired update: move learned prior toward observed frequency
    // weighted by credibility and sample size
    const observedFreq = confirmed / total;
    const learningRate = Math.min(0.3, total / 20); // more feedback → faster convergence, capped at 0.3
    const credibilityWeight = records.reduce((a, r) => a + r.credibility, 0) / records.length;

    // new prior = weighted blend of current prior and observed frequency
    const newPrior = oldPrior * (1 - learningRate * credibilityWeight) + observedFreq * (learningRate * credibilityWeight);
    const clampedNewPrior = Math.max(0.01, Math.min(0.95, newPrior));
    const deltaPct = ((clampedNewPrior - oldPrior) / oldPrior) * 100;

    // update the learned prior
    await db.learnedPrior.update({
      where: { hypothesisType: hType },
      data: {
        learnedPrior: clampedNewPrior,
        confirmations: confirmed,
        rejections: rejected,
        accuracy,
        lastUpdated: new Date(),
      },
    });

    // log the learning update
    await db.learningUpdate.create({
      data: {
        updateType: "prior",
        targetId: hType,
        oldValue: oldPrior,
        newValue: clampedNewPrior,
        deltaPct,
        feedbackCount: total,
        feedbackIds: JSON.stringify(records.map((r) => r.id)),
        accuracyBefore: prior.accuracy,
        accuracyAfter: accuracy,
      },
    });

    updates.push({
      hypothesisType: hType,
      oldPrior,
      newPrior: clampedNewPrior,
      deltaPct,
      accuracy,
    });
    priorsUpdated++;
  }

  emit.worldModelUpdated("learning-engine", priorsUpdated);

  return {
    feedbackApplied: feedback.length,
    priorsUpdated,
    updates,
  };
}

/**
 * Ensure all hypothesis types have a LearnedPrior record.
 */
async function ensureLearnedPriors(): Promise<void> {
  const existing = await db.learnedPrior.findMany();
  const existingTypes = new Set(existing.map((p) => p.hypothesisType));

  for (const [hType, def] of Object.entries(HYPOTHESIS_DEFS)) {
    if (!existingTypes.has(hType)) {
      await db.learnedPrior.create({
        data: {
          hypothesisType: hType,
          originalPrior: def.prior,
          learnedPrior: def.prior,
        },
      });
    }
  }
}

/**
 * Get current learned priors with accuracy metrics.
 */
export async function getLearnedPriors(): Promise<any[]> {
  await ensureLearnedPriors();
  const priors = await db.learnedPrior.findMany({
    orderBy: { accuracy: "desc" },
  });
  return priors.map((p) => ({
    id: p.id,
    hypothesisType: p.hypothesisType,
    originalPrior: p.originalPrior,
    learnedPrior: p.learnedPrior,
    priorDelta: p.learnedPrior - p.originalPrior,
    priorDeltaPct: ((p.learnedPrior - p.originalPrior) / p.originalPrior) * 100,
    confirmations: p.confirmations,
    rejections: p.rejections,
    falsePositives: p.falsePositives,
    falseNegatives: p.falseNegatives,
    accuracy: p.accuracy,
    lastUpdated: p.lastUpdated instanceof Date ? p.lastUpdated.toISOString() : p.lastUpdated,
  }));
}

/**
 * Get feedback history.
 */
export async function getFeedback(opts: { outcome?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.feedbackRecord.findMany({
    where: opts.outcome ? { outcome: opts.outcome } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    observationId: r.observationId,
    hypothesisId: r.hypothesisId,
    outcome: r.outcome,
    feedbackType: r.feedbackType,
    hypothesisType: r.hypothesisType,
    notes: r.notes,
    providerRole: r.providerRole,
    credibility: r.credibility,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

/**
 * Get learning update history.
 */
export async function getLearningHistory(limit = 20): Promise<any[]> {
  const rows = await db.learningUpdate.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    updateType: r.updateType,
    targetId: r.targetId,
    oldValue: r.oldValue,
    newValue: r.newValue,
    deltaPct: r.deltaPct,
    feedbackCount: r.feedbackCount,
    accuracyBefore: r.accuracyBefore,
    accuracyAfter: r.accuracyAfter,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}
