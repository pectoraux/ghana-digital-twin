import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const entry = await db.waitlistEntry.upsert({
      where: { email: body.email },
      update: {
        name: body.name, phone: body.phone, country: body.country,
        region: body.region, requestedRole: body.requestedRole, reason: body.reason,
      },
      create: {
        name: body.name, email: body.email, phone: body.phone, country: body.country,
        region: body.region, requestedRole: body.requestedRole, reason: body.reason,
        status: "pending",
      },
    });
    return NextResponse.json({ ok: true, entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function GET() {
  const entries = await db.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ entries, count: entries.length });
}
