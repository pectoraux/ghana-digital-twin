// POST /api/missions/[id]/join — join a mission
// GET  /api/missions/[id]/join — list participants

import { NextRequest, NextResponse } from "next/server";
import { joinMission, getMissionParticipants } from "@/lib/mission/participation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const participants = await getMissionParticipants(id);
  return NextResponse.json({ participants, count: participants.length });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  const userName = body.userName;

  if (!userId || !userName) {
    return NextResponse.json({ error: "userId and userName required" }, { status: 400 });
  }

  try {
    const participation = await joinMission({
      userId,
      userName,
      missionId: id,
      role: body.role,
    });
    return NextResponse.json({ participation });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
