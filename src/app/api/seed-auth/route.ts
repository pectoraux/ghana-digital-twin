import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export async function POST() {
  const existing = await db.user.count();
  if (existing > 0) return NextResponse.json({ ok: true, message: "Already seeded" });

  // Super admin
  const adminHash = await hashPassword("Payswap123456");
  await db.user.create({
    data: { email: "ekontetevi@gmail.com", passwordHash: adminHash, name: "Admin", role: "SUPER_ADMIN", status: "ACTIVE" },
  });

  // Demo accounts
  const demos = [
    { email: "kwesi.demo@example.com", name: "Kwesi Demo", role: "CITIZEN" },
    { email: "guardian.demo@example.com", name: "Guardian Demo", role: "COMMUNITY_GUARDIAN" },
    { email: "producer.demo@example.com", name: "Producer Demo", role: "INTELLIGENCE_PRODUCER" },
    { email: "epa.demo@example.com", name: "EPA Demo", role: "ORGANIZATION_MEMBER" },
    { email: "nadmo.demo@example.com", name: "NADMO Demo", role: "ORGANIZATION_MEMBER" },
    { email: "developer.demo@example.com", name: "Developer Demo", role: "DEVELOPER" },
    { email: "admin.demo@example.com", name: "Admin Demo", role: "ADMIN" },
  ];

  for (const d of demos) {
    const hash = await hashPassword("demo1234");
    await db.user.create({ data: { ...d, passwordHash: hash, status: "ACTIVE", isDemo: true } });
  }

  // Initial audit log
  await db.auditLog.create({
    data: {
      logId: `LOG-${Date.now().toString(36).toUpperCase()}-INIT`,
      action: "SYSTEM_INITIALIZED",
      metadata: JSON.stringify({ adminEmail: "ekontetevi@gmail.com", demoCount: demos.length }),
    },
  });

  return NextResponse.json({ ok: true, seeded: { admin: 1, demos: demos.length } });
}
