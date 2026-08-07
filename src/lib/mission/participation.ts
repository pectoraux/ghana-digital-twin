// Ghana Digital Twin — Mission Participation Service
// Lets citizens join intelligence missions, tracks participants, manages status.

import { db } from "@/lib/db";
import { timeAgo } from "@/lib/gdt/format";

export interface JoinMissionInput {
  userId: string;
  userName: string;
  missionId: string;
  role?: string;
}

export async function joinMission(input: JoinMissionInput): Promise<any> {
  const { userId, userName, missionId, role = "contributor" } = input;

  // Check mission exists
  const mission = await db.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new Error("Mission not found");

  // Check if already joined (unique constraint will also catch this)
  const existing = await db.missionParticipation.findUnique({
    where: { userId_missionId: { userId, missionId } },
  }).catch(() => null);

  if (existing) {
    if (existing.status === "active") {
      throw new Error("You have already joined this mission");
    }
    // Re-join if previously withdrawn
    const reactivated = await db.missionParticipation.update({
      where: { id: existing.id },
      data: { status: "active", joinedAt: new Date(), completedAt: null },
    });
    return serializeParticipation(reactivated, mission.title);
  }

  const seq = await db.missionParticipation.count({ where: { userId } });
  const participationId = `MP-2026-${String(seq + 1).padStart(4, "0")}`;

  const participation = await db.missionParticipation.create({
    data: {
      participationId,
      userId,
      userName,
      missionId,
      missionTitle: mission.title,
      role,
      status: "active",
    },
  });

  return serializeParticipation(participation, mission.title);
}

export async function withdrawFromMission(userId: string, missionId: string): Promise<any> {
  const result = await db.missionParticipation.updateMany({
    where: { userId, missionId, status: "active" },
    data: { status: "withdrawn" },
  });
  return { updated: result.count };
}

export async function getMissionParticipants(missionId: string): Promise<any[]> {
  const participants = await db.missionParticipation.findMany({
    where: { missionId, status: "active" },
    orderBy: { joinedAt: "desc" },
  });
  return participants.map((p: any) => ({
    id: p.id,
    participationId: p.participationId,
    userId: p.userId,
    userName: p.userName,
    role: p.role,
    status: p.status,
    joinedAt: p.joinedAt,
    joinedAtLabel: timeAgo(p.joinedAt),
  }));
}

export async function getUserMissions(userId: string): Promise<any[]> {
  const participations = await db.missionParticipation.findMany({
    where: { userId, status: "active" },
    orderBy: { joinedAt: "desc" },
  });
  return participations.map((p: any) => ({
    id: p.id,
    participationId: p.participationId,
    missionId: p.missionId,
    missionTitle: p.missionTitle,
    role: p.role,
    status: p.status,
    joinedAt: p.joinedAt,
    joinedAtLabel: timeAgo(p.joinedAt),
  }));
}

export async function getParticipantCount(missionId: string): Promise<number> {
  return db.missionParticipation.count({
    where: { missionId, status: "active" },
  });
}

function serializeParticipation(p: any, missionTitle: string) {
  return {
    id: p.id,
    participationId: p.participationId,
    userId: p.userId,
    userName: p.userName,
    missionId: p.missionId,
    missionTitle: missionTitle,
    role: p.role,
    status: p.status,
    joinedAt: p.joinedAt,
    joinedAtLabel: timeAgo(p.joinedAt),
  };
}
