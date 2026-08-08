// Ghana Digital Twin — API Request Validation (Phase 0.2)
// Shared zod schemas + helper to validate request bodies for mutating API routes.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ---- Schemas ----

export const createFeedItemSchema = z.object({
  type: z.enum(["ALERT", "REPORT", "ANALYSIS", "MISSION", "DISCUSSION", "ASSET", "ANNOUNCEMENT"]),
  creatorId: z.string().min(1),
  creatorName: z.string().min(1),
  creatorRole: z.string().min(1),
  organizationId: z.string().optional(),
  organizationName: z.string().optional(),
  title: z.string().min(3).max(200),
  summary: z.string().min(3).max(1000),
  body: z.string().max(5000).optional(),
  category: z.string().min(1),
  region: z.string().optional(),
  trustScore: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
});

export const feedEngagementSchema = z.object({
  feedItemId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  type: z.enum(["like", "comment", "share", "flag"]),
  content: z.string().max(500).optional(),
});

export const createCitizenEventSchema = z.object({
  citizenId: z.string().min(1),
  type: z.enum(["illegal_mining", "flood_risk", "deforestation", "water_pollution", "cocoa_disease", "land_degradation", "other"]),
  severity: z.enum(["low", "moderate", "high", "critical"]),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  regionId: z.string().optional(),
  location: z.object({
    lng: z.number(),
    lat: z.number(),
  }).optional(),
  accuracyM: z.number().min(0).optional(),
  occurredAt: z.string().optional(),
  selfConfidence: z.number().min(0).max(1).optional(),
});

export const witnessEventSchema = z.object({
  witnessId: z.string().min(1),
  response: z.enum(["confirm", "reject", "unknown"]),
  note: z.string().max(500).optional(),
  witnessLocation: z.object({
    lng: z.number(),
    lat: z.number(),
  }).optional(),
  hasEvidence: z.boolean().optional(),
  evidenceKind: z.string().optional(),
});

export const withdrawalSchema = z.object({
  userId: z.string().min(1),
  action: z.literal("withdraw"),
  amount: z.number().min(100, "Minimum withdrawal is 100 IC"),
  mobileMoneyNumber: z.string().regex(/^0\d{9}$/, "Phone number must be 10 digits starting with 0"),
  provider: z.enum(["mtn", "vodafone", "airteltigo"]).optional(),
});

export const joinMissionSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  role: z.string().optional(),
});

export const uploadPhotoSchema = z.object({
  citizenId: z.string().min(1),
  dataUrl: z.string().min(100, "Photo data is required").max(3_000_000, "Photo too large (max 3MB)"),
  thumbnailUrl: z.string().optional(),
  capturedAt: z.string().optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).optional(),
  fileSizeKb: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(300).optional(),
  region: z.string().optional(),
  interests: z.array(z.string().max(30)).max(20).optional(),
  skills: z.array(z.string().max(30)).max(20).optional(),
});

// ---- Helper ----

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

export async function parseBody(req: NextRequest): Promise<any> {
  return req.json().catch(() => ({}));
}
