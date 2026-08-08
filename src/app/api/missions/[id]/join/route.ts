// POST /api/missions/[id]/join — join a mission
// GET  /api/missions/[id]/join — list participants

import { NextRequest, NextResponse } from "next/server";
import { joinMission, getMissionParticipants } from "@/lib/mission/participation";
import { joinMissionSchema, validateBody, parseBody } from "@/lib/validation/schemas";

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
  const body = await parseBody(req);
  const validation = validateBody(joinMissionSchema, body);
  if (!validation.success) return validation.response;
  const { userId, userName, role } = validation.data;

  try {
    const participation = await joinMission({
      userId,
      userName,
      missionId: id,
      role,
    });
    return NextResponse.json({ participation });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
