// Ghana Digital Twin — User Activity API
// GET /api/activity?userId=...&limit=20 → unified timeline of user's actions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20"), 50);

  // Resolve the user's citizenId (for witness responses)
  const user = await db.user.findUnique({ where: { id: userId }, select: { citizenId: true } });
  const citizenId = user?.citizenId;

  // Fetch all activity types in parallel
  const [feedItems, comments, missionJoins, witnessResponses] = await Promise.all([
    // Reports the user published
    db.feedItem
      .findMany({
        where: { creatorId: userId, status: "published" },
        orderBy: { publishedAt: "desc" },
        take: limit,
        select: { feedItemId: true, type: true, title: true, region: true, publishedAt: true, confidence: true, likeCount: true, commentCount: true },
      })
      .catch(() => []),
    // Comments the user made
    db.feedEngagement
      .findMany({
        where: { userId, type: "comment" },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, feedItemId: true, content: true, createdAt: true },
      })
      .catch(() => []),
    // Missions the user joined
    db.missionParticipation
      .findMany({
        where: { userId, status: "active" },
        orderBy: { joinedAt: "desc" },
        take: limit,
        select: { id: true, participationId: true, missionId: true, missionTitle: true, role: true, joinedAt: true },
      })
      .catch(() => []),
    // Witness responses (if user has citizenId)
    citizenId
      ? db.witnessResponse
          .findMany({
            where: { witnessId: citizenId },
            orderBy: { respondedAt: "desc" },
            take: limit,
            select: { responseId: true, eventId: true, response: true, note: true, respondedAt: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  // Merge into unified timeline
  type Activity = {
    id: string;
    kind: string;
    action: string;
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
    meta?: string;
    timestamp: Date;
    actionView?: string;
    actionId?: string;
  };

  const activities: Activity[] = [];

  // Feed items → "Published report"
  for (const f of feedItems) {
    const colorMap: Record<string, string> = {
      ALERT: "#f43f5e",
      REPORT: "#fbbf24",
      ANALYSIS: "#a78bfa",
      MISSION: "#22d3ee",
      DISCUSSION: "#84cc16",
      ASSET: "#38bdf8",
      ANNOUNCEMENT: "#34d399",
    };
    activities.push({
      id: `feed-${f.feedItemId}`,
      kind: "report",
      action: "Published",
      title: f.title,
      subtitle: f.region ?? "Ghana",
      icon: "FileText",
      color: colorMap[f.type] ?? "#fbbf24",
      meta: `${(f.confidence * 100).toFixed(0)}% confidence · ${f.likeCount} likes · ${f.commentCount} comments`,
      timestamp: f.publishedAt,
      actionView: "feed",
      actionId: f.feedItemId,
    });
  }

  // Comments → "Commented on"
  for (const c of comments) {
    activities.push({
      id: `comment-${c.id}`,
      kind: "comment",
      action: "Commented on",
      title: c.content?.slice(0, 60) ?? "Comment",
      subtitle: c.feedItemId,
      icon: "MessageCircle",
      color: "#84cc16",
      meta: `On feed item ${c.feedItemId}`,
      timestamp: c.createdAt,
      actionView: "feed",
      actionId: c.feedItemId,
    });
  }

  // Mission joins → "Joined mission"
  for (const m of missionJoins) {
    activities.push({
      id: `mission-${m.id}`,
      kind: "mission",
      action: "Joined mission",
      title: m.missionTitle,
      subtitle: m.role,
      icon: "Target",
      color: "#22d3ee",
      meta: `As ${m.role} · ${m.participationId}`,
      timestamp: m.joinedAt,
      actionView: "missions",
      actionId: m.missionId,
    });
  }

  // Witness responses → "Verified event"
  for (const w of witnessResponses) {
    const respMeta: Record<string, { color: string; label: string }> = {
      confirm: { color: "#34d399", label: "Confirmed" },
      reject: { color: "#fb7185", label: "Rejected" },
      unknown: { color: "#a1a1aa", label: "Can't verify" },
    };
    const meta = respMeta[w.response] ?? respMeta.unknown;
    activities.push({
      id: `witness-${w.responseId}`,
      kind: "witness",
      action: meta.label,
      title: `Event ${w.eventId}`,
      subtitle: w.note ?? undefined,
      icon: w.response === "confirm" ? "CheckCircle2" : w.response === "reject" ? "XCircle" : "HelpCircle",
      color: meta.color,
      meta: `Witness response · ${w.responseId}`,
      timestamp: w.respondedAt,
      actionView: "community",
      actionId: w.eventId,
    });
  }

  // Sort by timestamp descending
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return NextResponse.json({
    activities: activities.slice(0, limit).map((a) => ({
      ...a,
      timestampLabel: timeAgoLabel(a.timestamp),
      timestamp: a.timestamp.toISOString(),
    })),
    total: activities.length,
  });
}

function timeAgoLabel(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
