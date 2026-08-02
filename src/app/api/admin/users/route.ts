import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, email: true, name: true, role: true, status: true, isDemo: true, lastLoginAt: true, createdAt: true } });
  return NextResponse.json({ users, count: users.length });
}
