import { NextRequest, NextResponse } from "next/server";
import { semanticMatch } from "@/lib/kernel/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = sp.get("q") || sp.get("query") || "";
  if (!query) return NextResponse.json({ error: "Provide q parameter" }, { status: 400 });
  const result = await semanticMatch(query);
  return NextResponse.json(result);
}
