import { NextRequest, NextResponse } from "next/server";
import { createArenaChallenge, getArenaChallenges } from "@/lib/governance/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const challenges = await getArenaChallenges();
  return NextResponse.json({ challenges, count: challenges.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const challengeId = await createArenaChallenge(body);
  return NextResponse.json({ challengeId });
}
