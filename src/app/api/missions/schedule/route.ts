import { NextResponse } from "next/server";
import { updateObservationSchedule } from "@/lib/mission/planner";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/missions/schedule — current observation schedule
export async function GET() {
  const schedules = await db.observationSchedule.findMany({
    orderBy: { priorityScore: "desc" },
    take: 100,
  });
  return NextResponse.json({ schedules, count: schedules.length });
}

// POST /api/missions/schedule — update autonomous observation schedule
export async function POST() {
  const result = await updateObservationSchedule();
  return NextResponse.json(result);
}
