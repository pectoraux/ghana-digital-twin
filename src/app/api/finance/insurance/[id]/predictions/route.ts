// POST /api/finance/insurance/[id]/predictions — submit a prediction

import { NextRequest, NextResponse } from "next/server";
import { submitPrediction } from "@/lib/finance/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const prediction = await submitPrediction({ ...body, policyId: id });
    return NextResponse.json({ prediction });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
