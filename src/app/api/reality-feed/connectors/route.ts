// GET /api/reality-feed/connectors — list data source connectors

import { NextResponse } from "next/server";
import { listConnectors } from "@/lib/reality-feed/engine";

export async function GET() {
  const connectors = await listConnectors();
  return NextResponse.json({ connectors, count: connectors.length });
}
