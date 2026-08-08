// GET /api/community/events — list events (auto-seeds on first call)
// POST /api/community/events — create a citizen event

import { NextRequest, NextResponse } from "next/server";
import { listCitizenEvents, createCitizenEvent } from "@/lib/community/engine";
import { seedCommunity } from "@/lib/community/seed";
import { createCitizenEventSchema, validateBody, parseBody } from "@/lib/validation/schemas";

export async function GET(req: NextRequest) {
  await seedCommunity();
  const sp = req.nextUrl.searchParams;
  const events = await listCitizenEvents({
    status: sp.get("status") ?? undefined,
    type: sp.get("type") ?? undefined,
    regionId: sp.get("regionId") ?? undefined,
    citizenId: sp.get("citizenId") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json({ events, count: events.length });
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const validation = validateBody(createCitizenEventSchema, body);
  if (!validation.success) return validation.response;
  const event = await createCitizenEvent(validation.data);
  return NextResponse.json({ event });
}
