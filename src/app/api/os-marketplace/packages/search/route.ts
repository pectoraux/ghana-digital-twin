// GET /api/os-marketplace/packages/search?q=...

import { NextRequest, NextResponse } from "next/server";
import { searchPackages } from "@/lib/os-marketplace/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const results = await searchPackages(q);
  return NextResponse.json({ results, count: results.length, query: q });
}
