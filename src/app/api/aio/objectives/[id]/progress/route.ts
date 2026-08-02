import { NextRequest, NextResponse } from "next/server";
import { recordProgress } from "@/lib/aio/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const progress = await recordProgress(id, body.measuredValue, body.note ?? "", body.measuredBy ?? "system");
    return NextResponse.json({ progress });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
