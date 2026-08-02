// GET /api/federation/requests — list cross-border requests

import { NextResponse } from "next/server";
import { listCrossBorderRequests } from "@/lib/federation/engine";

export async function GET() {
  const requests = await listCrossBorderRequests();
  return NextResponse.json({ requests, count: requests.length });
}
