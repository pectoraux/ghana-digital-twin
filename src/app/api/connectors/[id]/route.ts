import { NextRequest, NextResponse } from "next/server";
import { runConnector } from "@/lib/worldmodel/connector-framework";

export const dynamic = "force-dynamic";

// POST /api/connectors/:id/sync — trigger a single connector
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await runConnector(id);
    return NextResponse.json({
      sourceId: id,
      success: result.success,
      recordsRead: result.recordsRead,
      recordsWritten: result.recordsWritten,
      error: result.error,
      events: result.runEvents,
    });
  } catch (err) {
    return NextResponse.json(
      { sourceId: id, success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
