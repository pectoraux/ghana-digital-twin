import { NextResponse } from "next/server";
import { getEngineeringDashboard, getScientificDashboard } from "@/lib/validation/gates";

export const dynamic = "force-dynamic";

// GET /api/dashboards?type=engineering|scientific
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") || "engineering";

  if (type === "scientific") {
    const dashboard = await getScientificDashboard();
    return NextResponse.json({ type: "scientific", ...dashboard });
  }

  const dashboard = await getEngineeringDashboard();
  return NextResponse.json({ type: "engineering", ...dashboard });
}
