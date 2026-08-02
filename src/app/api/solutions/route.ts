import { NextResponse } from "next/server";
import { getSolutions, createSolution, initializeDeveloperPlatform } from "@/lib/platform/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const solutions = await getSolutions();
  return NextResponse.json({ solutions, count: solutions.length });
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "initialize") {
    const result = await initializeDeveloperPlatform();
    return NextResponse.json({ initialized: true, ...result });
  }
  const id = await createSolution(body);
  return NextResponse.json({ solutionId: id });
}
