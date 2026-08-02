import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/auth/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const adminId = body.adminId;
  const adminName = body.adminName;
  const adminRole = body.adminRole;

  const entry = await db.waitlistEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry.status !== "pending") return NextResponse.json({ error: "Already processed" }, { status: 400 });

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(2, 12);
  const passwordHash = await hashPassword(tempPassword);

  // Create user account
  const user = await db.user.create({
    data: {
      email: entry.email,
      passwordHash,
      name: entry.name,
      role: entry.requestedRole,
      status: "ACTIVE",
      phone: entry.phone,
      country: entry.country,
      region: entry.region,
    },
  });

  // Update waitlist entry
  await db.waitlistEntry.update({
    where: { id },
    data: { status: "approved", reviewedBy: adminId, reviewedAt: new Date(), createdUserId: user.id },
  });

  await logAudit("ADMIN_APPROVED_WAITLIST", adminId, adminName, adminRole, entry.id, entry.email, { createdUserId: user.id, role: entry.requestedRole });
  await logAudit("ADMIN_CREATED_ACCOUNT", adminId, adminName, adminRole, user.id, user.email, { role: user.role, tempPassword });

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, tempPassword });
}
