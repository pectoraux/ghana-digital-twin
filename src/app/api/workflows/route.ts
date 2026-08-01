import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const rows = await db.workflow.findMany({ orderBy: { reusable: "desc" } });
  return NextResponse.json({ workflows: rows, count: rows.length });
}
