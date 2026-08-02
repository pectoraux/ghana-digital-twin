import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/auth/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const user = await db.user.update({ where: { id }, data: { role: body.role ?? undefined, status: body.status ?? undefined } });
  await logAudit("ROLE_CHANGED", body.adminId, body.adminName, body.adminRole, id, user.email, { newRole: body.role, newStatus: body.status });
  return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role, status: user.status } });
}
