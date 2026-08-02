import { NextRequest, NextResponse } from "next/server";
import { listObjectives, createObjective } from "@/lib/aio/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const objectives = await listObjectives(sp.get("orgId") ?? undefined);
  return NextResponse.json({ objectives, count: objectives.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const obj = await createObjective(body);
  return NextResponse.json({ objective: obj });
}
