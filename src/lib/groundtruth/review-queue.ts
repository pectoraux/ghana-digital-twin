// Ghana Digital Twin — Active Learning & Review Queue
// Confidence-driven verification: the AI knows when it doesn't know.
// Selects observations that will teach the system the most (uncertainty sampling
// + diversity), creates review tasks, and tracks the verification workflow.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { emit } from "@/lib/worldmodel/event-bus";

export interface ActiveLearningSelection {
  observationId: string;
  hypothesisId: string;
  uncertaintyScore: number;
  informationGain: number;
  priority: string;
  reason: string;
}

/**
 * Select the N observations that would most reduce system uncertainty
 * if verified. Uses uncertainty sampling + diversity.
 *
 * Strategy:
 * 1. Find hypotheses with confidence near 0.5 (maximum uncertainty)
 * 2. Prioritize primary hypotheses (they drive decisions)
 * 3. Prefer observations not yet reviewed or with conflicting evidence
 * 4. Ensure diversity across types and locations
 */
export async function selectForActiveLearning(opts: { count?: number } = {}): Promise<ActiveLearningSelection[]> {
  const count = opts.count ?? 20;

  // load all hypotheses that are primary (drive decisions)
  const hypotheses = await db.hypothesis.findMany({
    where: { status: "candidate" },
    include: {
      observation: { select: { id: true, type: true, areaHa: true, mgrsTile: true, centroidLng: true, centroidLat: true } },
    },
  });

  // exclude hypotheses that already have ground truth or are in the review queue
  const reviewedObsIds = new Set(
    (await db.reviewQueue.findMany({
      where: { status: { in: ["reviewed", "ground_truth"] } },
      select: { observationId: true },
    })).map((r) => r.observationId)
  );

  const candidates = hypotheses.filter((h) => !reviewedObsIds.has(h.observationId));

  // compute uncertainty + information gain for each
  const scored = candidates.map((h) => {
    // uncertainty: 1 - |confidence - 0.5| * 2 (peaks at 0.5 confidence)
    const uncertainty = 1 - Math.abs(h.confidence - 0.5) * 2;

    // information gain: higher when supporting and contradicting evidence are balanced
    const totalEvidence = h.supportingCount + h.contradictingCount;
    const balance = totalEvidence > 0 ? 1 - Math.abs(h.supportingCount - h.contradictingCount) / totalEvidence : 0.5;
    const infoGain = uncertainty * 0.6 + balance * 0.4;

    // priority
    let priority = "normal";
    if (h.confidence < 0.4 && h.isPrimary) priority = "urgent";
    else if (h.confidence < 0.55 && h.isPrimary) priority = "high";
    else if (uncertainty > 0.7) priority = "high";

    const reason = h.confidence < 0.4
      ? `Low confidence (${(h.confidence * 100).toFixed(0)}%) — urgent verification needed`
      : h.confidence > 0.6 && h.confidence < 0.8
      ? `Moderate confidence (${(h.confidence * 100).toFixed(0)}%) — verification improves calibration`
      : `Uncertainty ${(uncertainty * 100).toFixed(0)}% — high information gain`;

    return {
      observationId: h.observationId,
      hypothesisId: h.id,
      uncertaintyScore: uncertainty,
      informationGain: infoGain,
      priority,
      reason,
      // for diversity filtering
      type: h.type,
      mgrsTile: h.observation.mgrsTile,
      confidence: h.confidence,
      isPrimary: h.isPrimary,
    };
  });

  // sort by information gain (descending)
  scored.sort((a, b) => b.informationGain - a.informationGain);

  // diversity: ensure we don't pick all the same type or tile
  const selected: ActiveLearningSelection[] = [];
  const typeCount: Record<string, number> = {};
  const tileCount: Record<string, number> = {};

  for (const s of scored) {
    if (selected.length >= count) break;
    // limit per type (max 5) and per tile (max 3) for diversity
    if ((typeCount[s.type] ?? 0) >= 5) continue;
    if ((tileCount[s.mgrsTile ?? ""] ?? 0) >= 3) continue;

    selected.push({
      observationId: s.observationId,
      hypothesisId: s.hypothesisId,
      uncertaintyScore: s.uncertaintyScore,
      informationGain: s.informationGain,
      priority: s.priority,
      reason: s.reason,
    });
    typeCount[s.type] = (typeCount[s.type] ?? 0) + 1;
    tileCount[s.mgrsTile ?? ""] = (tileCount[s.mgrsTile ?? ""] ?? 0) + 1;
  }

  return selected;
}

/**
 * Populate the review queue with the most informative observations.
 */
export async function populateReviewQueue(opts: { count?: number } = {}): Promise<number> {
  const selections = await selectForActiveLearning(opts);

  let created = 0;
  for (const s of selections) {
    // check if already in queue
    const existing = await db.reviewQueue.findFirst({
      where: { observationId: s.observationId, status: { in: ["needs_review", "assigned"] } },
    });
    if (existing) continue;

    await db.reviewQueue.create({
      data: {
        observationId: s.observationId,
        hypothesisId: s.hypothesisId,
        status: "needs_review",
        priority: s.priority,
        priorityScore: s.informationGain,
        uncertaintyScore: s.uncertaintyScore,
        informationGain: s.informationGain,
      },
    });
    created++;
  }

  emit.worldModelUpdated("active-learning", created);
  return created;
}

/**
 * Assign a review task to a reviewer.
 */
export async function assignReview(reviewId: string, reviewerId: string): Promise<void> {
  await db.reviewQueue.update({
    where: { id: reviewId },
    data: {
      status: "assigned",
      assignedTo: reviewerId,
      assignedAt: new Date(),
    },
  });
}

/**
 * Submit a review decision — creates GroundTruth + updates LearningEngine.
 */
export async function submitReview(
  reviewId: string,
  opts: {
    outcome: "confirmed" | "rejected" | "partial" | "needs_monitoring";
    notes?: string;
    evidence?: Record<string, any>;
    verifiedHypothesisType?: string;
    verificationMethod?: string;
    reviewerId?: string;
    reviewerRole?: string;
    credibility?: number;
  }
): Promise<{ groundTruthId: string }> {
  const review = await db.reviewQueue.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error("Review not found");

  // update review queue
  await db.reviewQueue.update({
    where: { id: reviewId },
    data: {
      status: opts.outcome === "needs_monitoring" ? "reviewed" : "ground_truth",
      reviewOutcome: opts.outcome,
      reviewNotes: opts.notes,
      reviewEvidence: JSON.stringify(opts.evidence ?? {}),
      reviewedAt: new Date(),
      reviewedBy: opts.reviewerId,
    },
  });

  // create ground truth record
  const gt = await db.groundTruth.create({
    data: {
      observationId: review.observationId,
      hypothesisId: review.hypothesisId,
      verifiedOutcome: opts.outcome,
      verifiedHypothesisType: opts.verifiedHypothesisType,
      verificationMethod: opts.verificationMethod || "field_inspection",
      confidence: 1.0,
      evidenceSummary: opts.notes || "Field verification",
      evidenceData: JSON.stringify(opts.evidence ?? {}),
      verifiedBy: opts.reviewerId,
      verifierRole: opts.reviewerRole || "inspector",
      verifierCredibility: opts.credibility ?? 0.8,
    },
  });

  // also create feedback record for the learning engine
  await db.feedbackRecord.create({
    data: {
      observationId: review.observationId,
      hypothesisId: review.hypothesisId,
      outcome: opts.outcome as string,
      feedbackType: opts.verificationMethod || "human_inspector",
      hypothesisType: opts.verifiedHypothesisType,
      notes: opts.notes,
      evidence: JSON.stringify(opts.evidence ?? {}),
      providerId: opts.reviewerId,
      providerRole: opts.reviewerRole || "inspector",
      credibility: opts.credibility ?? 0.8,
    },
  });

  emit.entityCreated("ground-truth", gt.id, `Ground truth: ${opts.outcome}`);
  return { groundTruthId: gt.id };
}

// ---- Reads ----

export async function getReviewQueue(opts: { status?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.reviewQueue.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 50,
    include: {
      observation: { select: { id: true, type: true, title: true, areaHa: true, mgrsTile: true, confidence: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    observationId: r.observationId,
    hypothesisId: r.hypothesisId,
    status: r.status,
    priority: r.priority,
    priorityScore: r.priorityScore,
    uncertaintyScore: r.uncertaintyScore,
    informationGain: r.informationGain,
    assignedTo: r.assignedTo,
    reviewOutcome: r.reviewOutcome,
    reviewNotes: r.reviewNotes,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt,
    observation: r.observation,
  }));
}

export async function getGroundTruths(opts: { limit?: number } = {}): Promise<any[]> {
  const rows = await db.groundTruth.findMany({
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    observationId: r.observationId,
    verifiedOutcome: r.verifiedOutcome,
    verifiedHypothesisType: r.verifiedHypothesisType,
    verificationMethod: r.verificationMethod,
    confidence: r.confidence,
    evidenceSummary: r.evidenceSummary,
    verifierRole: r.verifierRole,
    verifierCredibility: r.verifierCredibility,
    learningApplied: r.learningApplied,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

export async function getReviewQueueStats(): Promise<any> {
  const [needsReview, assigned, reviewed, groundTruth] = await Promise.all([
    db.reviewQueue.count({ where: { status: "needs_review" } }),
    db.reviewQueue.count({ where: { status: "assigned" } }),
    db.reviewQueue.count({ where: { status: "reviewed" } }),
    db.reviewQueue.count({ where: { status: "ground_truth" } }),
  ]);
  const urgent = await db.reviewQueue.count({ where: { status: "needs_review", priority: "urgent" } });
  const gtCount = await db.groundTruth.count();
  return { needsReview, assigned, reviewed, groundTruth, urgent, totalGroundTruth: gtCount };
}
