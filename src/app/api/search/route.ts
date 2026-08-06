// Ghana Digital Twin — Global Search API
// GET /api/search?q=<query> → searches feed items, community events, citizens, missions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: { feed: [], events: [], citizens: [], missions: [] } });
  }

  const limit = 5;

  const [feed, events, citizens, missions] = await Promise.all([
    // Search feed items by title/summary
    db.feedItem
      .findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
          ],
          status: "published",
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        select: {
          feedItemId: true,
          type: true,
          title: true,
          summary: true,
          creatorName: true,
          region: true,
          publishedAt: true,
        },
      })
      .catch(() => []),
    // Search community events by title/description
    db.citizenEvent
      .findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { reportedAt: "desc" },
        take: limit,
        select: {
          eventId: true,
          type: true,
          title: true,
          description: true,
          regionId: true,
          status: true,
          reportedAt: true,
        },
      })
      .catch(() => []),
    // Search citizens by handle/bio
    db.citizen
      .findMany({
        where: {
          OR: [
            { handle: { contains: q, mode: "insensitive" } },
            { bio: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          citizenId: true,
          handle: true,
          trustLevel: true,
          civicScore: true,
          regionId: true,
        },
      })
      .catch(() => []),
    // Search missions by title/description
    db.mission
      .findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
        },
      })
      .catch(() => []),
  ]);

  return NextResponse.json({
    results: {
      feed: feed.map((f: any) => ({
        kind: "feed" as const,
        id: f.feedItemId,
        type: f.type,
        title: f.title,
        subtitle: f.summary,
        meta: `${f.creatorName} · ${f.region ?? "Ghana"}`,
        actionView: "feed",
        actionId: f.feedItemId,
      })),
      events: events.map((e: any) => ({
        kind: "event" as const,
        id: e.eventId,
        type: e.type,
        title: e.title,
        subtitle: e.description,
        meta: `${e.regionId ?? "Ghana"} · ${e.status}`,
        actionView: "community",
        actionId: e.eventId,
      })),
      citizens: citizens.map((c: any) => ({
        kind: "citizen" as const,
        id: c.citizenId,
        title: c.handle,
        subtitle: "",
        meta: `${c.trustLevel} · Civic ${c.civicScore?.toFixed(0) ?? 0} · ${c.regionId ?? "Ghana"}`,
        actionView: "community",
        actionId: c.citizenId,
      })),
      missions: missions.map((m: any) => ({
        kind: "mission" as const,
        id: m.id,
        type: m.type,
        title: m.title,
        subtitle: m.description,
        meta: `${m.type} · ${m.status}`,
        actionView: "missions",
        actionId: m.id,
      })),
    },
    query: q,
  });
}
