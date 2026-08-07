// Ghana Digital Twin — Home Mini-Map Data API
// GET /api/home/map-data?userId=... → recent alerts + events with coordinates

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { REGIONS } from "@/lib/gdt/geo";

const REGION_NAME_TO_CENTROID: Record<string, { lng: number; lat: number }> = Object.fromEntries(
  REGIONS.map((r) => [r.name, { lng: r.centroid[0], lat: r.centroid[1] }])
);

const REGION_ID_TO_CENTROID: Record<string, { lng: number; lat: number; name: string }> = Object.fromEntries(
  REGIONS.map((r) => [r.id, { lng: r.centroid[0], lat: r.centroid[1], name: r.name }])
);

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  let userRegionName = "Greater Accra";
  if (userId) {
    const profile = await db.userProfile.findUnique({ where: { userId } }).catch(() => null);
    if (profile?.region) userRegionName = profile.region;
  }

  const [feedAlerts, communityEvents] = await Promise.all([
    db.feedItem
      .findMany({
        where: { status: "published", type: { in: ["ALERT", "REPORT", "MISSION"] } },
        orderBy: { publishedAt: "desc" },
        take: 8,
        select: { feedItemId: true, type: true, title: true, region: true, confidence: true, publishedAt: true },
      })
      .catch(() => []),
    db.citizenEvent
      .findMany({
        where: { status: { in: ["witnessing", "created", "broadcast"] } },
        orderBy: { reportedAt: "desc" },
        take: 6,
        select: { eventId: true, type: true, title: true, regionId: true, status: true, fusedConfidence: true, location: true },
      })
      .catch(() => []),
  ]);

  const feedMarkers = feedAlerts.map((f: any) => {
    const region = f.region ?? userRegionName;
    const c = REGION_NAME_TO_CENTROID[region] ?? REGION_NAME_TO_CENTROID["Greater Accra"];
    return {
      id: f.feedItemId, kind: "feed" as const, type: f.type, title: f.title,
      region, confidence: f.confidence,
      lng: c.lng + (Math.random() - 0.5) * 0.3, lat: c.lat + (Math.random() - 0.5) * 0.3,
    };
  });

  const eventMarkers = communityEvents.map((e: any) => {
    let lng = -0.19, lat = 5.6;
    try {
      const loc = JSON.parse(e.location || "{}");
      if (loc.lng && loc.lat) { lng = loc.lng; lat = loc.lat; }
      else if (e.regionId && REGION_ID_TO_CENTROID[e.regionId]) {
        lng = REGION_ID_TO_CENTROID[e.regionId].lng; lat = REGION_ID_TO_CENTROID[e.regionId].lat;
      }
    } catch {
      if (e.regionId && REGION_ID_TO_CENTROID[e.regionId]) {
        lng = REGION_ID_TO_CENTROID[e.regionId].lng; lat = REGION_ID_TO_CENTROID[e.regionId].lat;
      }
    }
    return {
      id: e.eventId, kind: "event" as const, type: e.type, title: e.title,
      region: e.regionId ? REGION_ID_TO_CENTROID[e.regionId]?.name ?? e.regionId : "Ghana",
      confidence: e.fusedConfidence, status: e.status,
      lng: lng + (Math.random() - 0.5) * 0.2, lat: lat + (Math.random() - 0.5) * 0.2,
    };
  });

  return NextResponse.json({
    markers: [...feedMarkers, ...eventMarkers],
    userRegion: userRegionName,
    userRegionCentroid: REGION_NAME_TO_CENTROID[userRegionName] ?? REGION_NAME_TO_CENTROID["Greater Accra"],
  });
}
