import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/auth/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const entry = await db.waitlistEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.waitlistEntry.update({ where: { id }, data: { status: "rejected", reviewedBy: body.adminId, reviewedAt: new Date(), reviewNote: body.note ?? "Rejected" } });
  await logAudit("ADMIN_REJECTED_WAITLIST", body.adminId, body.adminName, body.adminRole, entry.id, entry.email, { note: body.note });

  return NextResponse.json({ ok: true });
}
