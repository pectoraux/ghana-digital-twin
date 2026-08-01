// POST /api/marketplace/submissions/[id]/accept { reviewedBy, note }

import { NextRequest, NextResponse } from "next/server";
import { acceptSubmission } from "@/lib/marketplace/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const result = await acceptSubmission(id, body.reviewedBy ?? "reviewer", body.note ?? "");
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
