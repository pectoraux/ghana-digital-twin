// POST /api/os-marketplace/packages/[id]/install { downloaderId, downloaderName, downloaderType }

import { NextRequest, NextResponse } from "next/server";
import { recordDownload } from "@/lib/os-marketplace/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const dl = await recordDownload(id, body.version ?? "1.0.0", body.downloaderId, body.downloaderName, body.downloaderType ?? "organization");
    return NextResponse.json({ download: dl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
