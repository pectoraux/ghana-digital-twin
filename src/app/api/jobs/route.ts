import { NextRequest, NextResponse } from "next/server";
import { getJobs, createJob } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const jobs = await getJobs({
    jobType: sp.get("jobType") || undefined,
    status: sp.get("status") || undefined,
  });
  return NextResponse.json({ jobs, count: jobs.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId = await createJob(body);
  return NextResponse.json({ jobId });
}
