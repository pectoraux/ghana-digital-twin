// POST /api/community/citizens/register — register a new citizen

import { NextRequest, NextResponse } from "next/server";
import { registerCitizen } from "@/lib/community/engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const citizen = await registerCitizen(body);
  return NextResponse.json({ citizen });
}
