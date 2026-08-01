import { NextRequest, NextResponse } from "next/server";
import { sendAgentMessage, getAgentMessages } from "@/lib/governance/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const messages = await getAgentMessages({ agentId: sp.get("agentId") || undefined, limit: parseInt(sp.get("limit") || "50") });
  return NextResponse.json({ messages, count: messages.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messageId = await sendAgentMessage(body);
  return NextResponse.json({ messageId });
}
