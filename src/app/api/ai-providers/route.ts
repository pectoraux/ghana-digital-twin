import { NextResponse } from "next/server";
import { getAIProviders } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const providers = await getAIProviders();
  return NextResponse.json({ providers, count: providers.length });
}
