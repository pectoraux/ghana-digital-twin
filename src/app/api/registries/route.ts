import { NextResponse } from "next/server";
import { getRemoteRegistries } from "@/lib/platform/specification";
export const dynamic = "force-dynamic";
export async function GET() {
  const registries = await getRemoteRegistries();
  return NextResponse.json({ registries, count: registries.length });
}
