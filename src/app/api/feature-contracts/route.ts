import { NextResponse } from "next/server";
import { getFeatureContracts } from "@/lib/platform/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const contracts = await getFeatureContracts();
  return NextResponse.json({ contracts, count: contracts.length });
}
