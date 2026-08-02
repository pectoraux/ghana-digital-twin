// GET /api/federation/identity — list trust proofs
// POST /api/federation/identity — issue a trust proof

import { NextRequest, NextResponse } from "next/server";
import { listTrustProofs, issueTrustProof } from "@/lib/federation/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const proofs = await listTrustProofs({
    issuingNodeId: sp.get("issuingNodeId") ?? undefined,
    receivingNodeId: sp.get("receivingNodeId") ?? undefined,
    subjectId: sp.get("subjectId") ?? undefined,
  });
  return NextResponse.json({ proofs, count: proofs.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const proof = await issueTrustProof(body);
  return NextResponse.json({ proof });
}
