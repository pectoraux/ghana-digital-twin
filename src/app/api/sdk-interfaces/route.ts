import { NextResponse } from "next/server";
import { getFrozenSDKInterfaces, freezeSDKInterfaces } from "@/lib/platform/specification";
export const dynamic = "force-dynamic";
export async function GET() {
  const interfaces = await getFrozenSDKInterfaces();
  return NextResponse.json({ interfaces, count: interfaces.length });
}
export async function POST() {
  const count = await freezeSDKInterfaces();
  return NextResponse.json({ frozen: count });
}
