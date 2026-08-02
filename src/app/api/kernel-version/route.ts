import { NextResponse } from "next/server";
import { getKernelVersion, initializeKernel } from "@/lib/kernel/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const version = await getKernelVersion();
  return NextResponse.json(version);
}
export async function POST() {
  const result = await initializeKernel();
  return NextResponse.json({ initialized: true, ...result });
}
