// GET /api/governance-intel/institutions — list institutions (auto-seeds)
// POST /api/governance-intel/institutions
//   { action: "evaluate", institutionId } — evaluate an institution's reputation
//   { institutionId, name, institutionType, countryCode? } — register a new institution

import { NextRequest, NextResponse } from "next/server";
import { listInstitutions, registerInstitution, evaluateInstitution } from "@/lib/governance-intel/engine";
import { seedGovernanceIntel } from "@/lib/governance-intel/seed";

export async function GET() {
  await seedGovernanceIntel().catch(() => null);
  const institutions = await listInstitutions();
  return NextResponse.json({ institutions, count: institutions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "evaluate") {
      const institution = await evaluateInstitution(body.institutionId);
      return NextResponse.json({ ok: true, institution });
    }
    // Otherwise — register a new institution
    const institution = await registerInstitution({
      institutionId: body.institutionId,
      name: body.name,
      institutionType: body.institutionType,
      countryCode: body.countryCode,
    });
    return NextResponse.json({ institution });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
