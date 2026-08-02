// POST /api/reality-feed/ingest — trigger a fresh ingestion (Sentinel-2 STAC)

import { NextRequest, NextResponse } from "next/server";
import { runSentinel2Ingestion } from "@/lib/reality-feed/seed";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.connectorId === "stac-sentinel-2" || !body.connectorId) {
      const result = await runSentinel2Ingestion();
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "Unknown connector" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
