// GET  /api/community/events/[id]/photos — list photos attached to an event
// POST /api/community/events/[id]/photos — upload a geotagged photo to an event
//
// Phase 3.13: real proof capture. Each photo gets a PHOTO-YYYY-NNNN id,
// stores the base64 dataUrl client-side captured, and is cross-checked
// against the event location (within 500m → locationVerified = true).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const LOCATION_MATCH_RADIUS_M = 500;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB safety — client compresses to <2MB

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function nextPhotoId(): Promise<string> {
  const year = new Date().getFullYear();
  // Count existing photos for this year, plus a small bump for concurrency safety
  const count = await db.eventPhoto.count();
  const seq = String(count + 1).padStart(4, "0");
  return `PHOTO-${year}-${seq}`;
}

function parseEventLocation(raw: string | null): { lng: number; lat: number } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (typeof o?.lat === "number" && typeof o?.lng === "number") return o;
    return null;
  } catch {
    return null;
  }
}

function serializePhoto(r: any) {
  return {
    id: r.id,
    photoId: r.photoId,
    eventId: r.eventId,
    citizenId: r.citizenId,
    thumbnailUrl: r.thumbnailUrl ?? r.dataUrl,
    capturedAt: r.capturedAt,
    gpsLat: r.gpsLat,
    gpsLng: r.gpsLng,
    accuracyM: r.accuracyM,
    locationVerified: r.locationVerified,
    fileSizeKb: r.fileSizeKb,
    width: r.width,
    height: r.height,
    uploadedAt: r.uploadedAt,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params();
  const rows = await db.eventPhoto.findMany({
    where: { eventId: id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ photos: rows.map(serializePhoto), count: rows.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const citizenId: string | undefined = body.citizenId;
  const dataUrl: string | undefined = body.dataUrl;
  const thumbnailUrl: string | undefined = body.thumbnailUrl;

  if (!citizenId || !dataUrl) {
    return NextResponse.json({ error: "Missing required fields: citizenId, dataUrl" }, { status: 400 });
  }
  if (!dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "dataUrl must be a base64 image data URL" }, { status: 400 });
  }
  if (dataUrl.length > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Photo too large. Compress to <2MB before upload." }, { status: 413 });
  }

  // Verify event exists
  const event = await db.citizenEvent.findUnique({ where: { eventId: id } });
  if (!event) return NextResponse.json({ error: `Event ${id} not found` }, { status: 404 });

  // Cross-check photo GPS against event location
  const photoLat: number | undefined = typeof body.gpsLat === "number" ? body.gpsLat : undefined;
  const photoLng: number | undefined = typeof body.gpsLng === "number" ? body.gpsLng : undefined;
  const eventLoc = parseEventLocation(event.location);

  let locationVerified = false;
  if (photoLat != null && photoLng != null && eventLoc) {
    const dist = haversineM(eventLoc.lat, eventLoc.lng, photoLat, photoLng);
    locationVerified = dist <= LOCATION_MATCH_RADIUS_M;
  }

  const photoId = await nextPhotoId();
  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();

  const photo = await db.eventPhoto.create({
    data: {
      photoId,
      eventId: id,
      citizenId,
      dataUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      capturedAt,
      gpsLat: photoLat ?? null,
      gpsLng: photoLng ?? null,
      accuracyM: typeof body.accuracyM === "number" ? body.accuracyM : null,
      locationVerified,
      fileSizeKb: typeof body.fileSizeKb === "number" ? Math.round(body.fileSizeKb) : 0,
      width: typeof body.width === "number" ? Math.round(body.width) : 0,
      height: typeof body.height === "number" ? Math.round(body.height) : 0,
      perceptualHash: null,
    },
  });

  // Update CitizenEvent flags — mark event as having photo evidence
  await db.citizenEvent.update({
    where: { eventId: id },
    data: {
      hasPhoto: true,
      hasGps: event.hasGps || (photoLat != null && photoLng != null),
      textOnly: false,
    },
  });

  // Bump fused confidence slightly — photo evidence is real signal
  if (locationVerified) {
    const next = Math.min(1, (event.fusedConfidence ?? 0) + 0.05);
    await db.citizenEvent.update({ where: { eventId: id }, data: { fusedConfidence: next } }).catch(() => null);
  }

  return NextResponse.json({ photo: serializePhoto(photo), locationVerified });
}
