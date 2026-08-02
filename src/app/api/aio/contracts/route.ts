import { NextRequest, NextResponse } from "next/server";
import { listContracts, employAgent } from "@/lib/aio/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const contracts = await listContracts(sp.get("orgId") ?? undefined);
  return NextResponse.json({ contracts, count: contracts.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contract = await employAgent(body);
  return NextResponse.json({ contract });
}
