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

  const groundTruth = await db.groundTruth.create({
    data: {
      verifiedOutcome: "confirmed",
      verifiedHypothesisType: mapEventTypeToHypothesis(event.type),
      verificationMethod: "community_verification",
      confidence: Math.min(1, event.fusedConfidence + 0.1),
      evidenceSummary: `Community-verified event: ${event.title}. ${confirms} confirms out of ${total} witnesses (${(ratio * 100).toFixed(0)}% agreement).`,
      evidenceData: JSON.stringify({
        eventId: event.eventId,
        eventType: event.type,
        confirms,
        rejects: event.rejectCount,
        totalWitnesses: total,
        confirmRatio: ratio,
        fusedConfidence: event.fusedConfidence,
        hasPhoto: event.hasPhoto,
      }),
      verifiedBy: event.citizenId,
      verifierRole: "community_lead",
      verifierCredibility: 0.8,
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
