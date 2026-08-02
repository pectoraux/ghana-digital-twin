import { NextRequest, NextResponse } from "next/server";
import { getCharter, createCharter } from "@/lib/aio/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const orgId = sp.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const charter = await getCharter(orgId);
  if (!charter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ charter });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const charter = await createCharter(body);
  return NextResponse.json({ charter });
}
