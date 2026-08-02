// GET /api/command-center/roles — list institutional roles
// POST /api/command-center/roles — register a role

import { NextRequest, NextResponse } from "next/server";
import { listRoles, registerRole, checkPermission } from "@/lib/command/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const roles = await listRoles();
  // optional: check a permission
  const roleId = sp.get("checkRole");
  const decisionType = sp.get("decisionType");
  let permissionCheck = null;
  if (roleId && decisionType) {
    permissionCheck = await checkPermission(roleId, decisionType);
  }
  return NextResponse.json({ roles, count: roles.length, permissionCheck });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const role = await registerRole(body);
  return NextResponse.json({ role });
}
