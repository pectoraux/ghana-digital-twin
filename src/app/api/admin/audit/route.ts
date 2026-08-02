import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const logs = await db.auditLog.findMany({
    where: sp.get("action") ? { action: sp.get("action")! } : undefined,
    orderBy: { timestamp: "desc" },
    take: 50,
  });
  return NextResponse.json({ logs, count: logs.length });
}
