import { NextResponse } from "next/server";
import { getCacheStats, clearExpiredCache } from "@/lib/validation/cache";

export const dynamic = "force-dynamic";

// GET /api/cache — cache statistics
export async function GET() {
  const stats = await getCacheStats();
  return NextResponse.json(stats);
}

// POST /api/cache — clear expired entries
export async function POST() {
  const cleared = await clearExpiredCache();
  const stats = await getCacheStats();
  return NextResponse.json({ ...stats, cleared });
}
