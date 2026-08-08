// Ghana Digital Twin — Calibration Loop Service (Phase 3.15)
// Closes the loop: confirmed community events → GroundTruth → computeCalibration.

import { db } from "@/lib/db";
import { computeCalibration } from "@/lib/groundtruth/calibration";

const CONFIRM_THRESHOLD = 3;
const CONFIRM_RATIO_THRESHOLD = 0.6;

export interface AutoConfirmResult {
  eventId: string;
  confirmed: boolean;
  reason: string;
  groundTruthId?: string;
  calibrationTriggered?: boolean;
}

export async function checkAutoConfirmation(eventId: string): Promise<AutoConfirmResult> {
  const event = await db.citizenEvent.findUnique({ where: { eventId } });
  if (!event) return { eventId, confirmed: false, reason: "Event not found" };
  if (event.status === "verified" || event.status === "resolved" || event.status === "learned") {
    return { eventId, confirmed: false, reason: `Already ${event.status}` };
  }

  const confirms = event.confirmCount;
  const total = event.witnessCount;
  const ratio = total > 0 ? confirms / total : 0;

  if (confirms < CONFIRM_THRESHOLD) {
    return { eventId, confirmed: false, reason: `Only ${confirms}/${CONFIRM_THRESHOLD} confirms` };
  }
  if (ratio < CONFIRM_RATIO_THRESHOLD) {
    return { eventId, confirmed: false, reason: `Ratio ${ratio.toFixed(2)} < ${CONFIRM_RATIO_THRESHOLD}` };
  }

  await db.citizenEvent.update({
    where: { eventId },
    data: { status: "verified", verifiedAt: new Date(), updatedAt: new Date() },
  });

  // Phase 3.16: Compute verifier credibility from the reporter's actual track record
  // Bad-faith or careless reporters get down-weighted over time.
  const reporter = await db.citizen.findUnique({ where: { citizenId: event.citizenId } }).catch(() => null);
  const verifierCredibility = computeVerifierCredibility(reporter);

  const groundTruth = await db.groundTruth.create({
    data: {
      verifiedOutcome: "confirmed",
      verifiedHypothesisType: mapEventTypeToHypothesis(event.type),
      verificationMethod: "community_verification",
      confidence: Math.min(1, event.fusedConfidence + 0.1),
      evidenceSummary: `Community-verified event: ${event.title}. ${confirms} confirms out of ${total} witnesses (${(ratio * 100).toFixed(0)}% agreement). Reporter credibility: ${verifierCredibility.toFixed(2)}.`,
      evidenceData: JSON.stringify({
        eventId: event.eventId,
        eventType: event.type,
        confirms,
        rejects: event.rejectCount,
        totalWitnesses: total,
        confirmRatio: ratio,
        fusedConfidence: event.fusedConfidence,
        hasPhoto: event.hasPhoto,
        reporterTrustLevel: reporter?.trustLevel ?? "new",
        reporterCivicScore: reporter?.civicScore ?? 50,
        verifierCredibility,
      }),
      verifiedBy: event.citizenId,
      verifierRole: reporter?.trustLevel === "expert" || reporter?.trustLevel === "verified" ? "community_lead" : "citizen",
      verifierCredibility,
      learningApplied: false,
    },
  });

  let calibrationTriggered = false;
  try {
    await computeCalibration();
    calibrationTriggered = true;
    await db.groundTruth.update({
      where: { id: groundTruth.id },
      data: { learningApplied: true },
    });
  } catch {
    // Calibration may fail if there aren't enough hypothesis-GT pairs yet
  }

  return {
    eventId,
    confirmed: true,
    reason: `Auto-verified: ${confirms} confirms, ${(ratio * 100).toFixed(0)}% agreement`,
    groundTruthId: groundTruth.id,
    calibrationTriggered,
  };
}

function mapEventTypeToHypothesis(eventType: string): string | null {
  const map: Record<string, string> = {
    illegal_mining: "artisanal_mining",
    deforestation: "deforestation",
    flood_risk: "flood_erosion",
    water_pollution: "artisanal_mining",
    cocoa_disease: "agricultural_expansion",
    land_degradation: "quarrying",
    other: null,
  };
  return map[eventType] ?? null;
}

/**
 * Phase 3.16: Compute verifier credibility from a citizen's actual track record.
 * Bad-faith or careless reporters get down-weighted over time.
 *
 * Formula: base trust (from trust level) × accuracy rate (confirmed / total reports)
 * - expert: base 0.95, verified: 0.85, trusted: 0.75, new: 0.60
 * - If totalReports == 0: use base (no track record yet)
 * - If falseReports rate > 30%: down-weight by 0.5
 */
function computeVerifierCredibility(citizen: any | null): number {
  if (!citizen) return 0.5; // unknown citizen — low trust

  // Base credibility from trust level
  const baseByLevel: Record<string, number> = {
    expert: 0.95,
    verified: 0.85,
    trusted: 0.75,
    new: 0.60,
  };
  let credibility = baseByLevel[citizen.trustLevel] ?? 0.60;

  // Adjust based on track record
  const totalReports = citizen.totalReports ?? 0;
  const confirmed = citizen.confirmedReports ?? 0;
  const falseReports = citizen.falseReports ?? 0;

  if (totalReports > 0) {
    const accuracyRate = confirmed / totalReports;
    const falseRate = falseReports / totalReports;

    // Up-weight for high accuracy
    if (accuracyRate > 0.8) {
      credibility = Math.min(0.99, credibility + 0.1);
    }

    // Down-weight heavily for high false-report rate
    if (falseRate > 0.3) {
      credibility *= 0.5;
    } else if (falseRate > 0.15) {
      credibility *= 0.75;
    }

    // Down-weight if flagged for review
    if (citizen.flaggedForReview) {
      credibility *= 0.3;
    }
  }

  return Math.round(credibility * 100) / 100;
}

export async function getCalibrationLoopStats(): Promise<any> {
  const [totalGT, communityGT, learnedGT, eventsVerified] = await Promise.all([
    db.groundTruth.count(),
    db.groundTruth.count({ where: { verificationMethod: "community_verification" } }),
    db.groundTruth.count({ where: { learningApplied: true } }),
    db.citizenEvent.count({ where: { status: "verified" } }),
  ]);

  return {
    totalGroundTruth: totalGT,
    communityVerified: communityGT,
    learningApplied: learnedGT,
    eventsAutoVerified: eventsVerified,
    confirmThreshold: CONFIRM_THRESHOLD,
    confirmRatioThreshold: CONFIRM_RATIO_THRESHOLD,
  };
}
