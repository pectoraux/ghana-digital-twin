// Ghana Digital Twin — Sentinel-1 SAR Connector (Phase 1.6)
// Cloud-penetrating radar imagery — closes the rainy-season blind spot.
//
// The audit (§2.4) notes: "Ghana's rainy season (roughly April–October)
// means optical Sentinel-2 imagery is frequently cloud-obstructed... no
// Sentinel-1/SAR connector exists. For a large fraction of the year,
// the optical-only pipeline is effectively blind exactly when illegal
// mining and flooding are most active."
//
// This connector fetches Sentinel-1 GRD (Ground Range Detected) scene
// metadata from the Element 84 Earth Search STAC API, same as the
// Sentinel-2 connector but for the sentinel-1-grd collection.
// SAR data enables:
// - Surface disturbance detection during cloudy/rainy periods
// - Water body mapping (flood extent) regardless of cloud cover
// - Vegetation structure monitoring (different from optical NDVI)

import { BaseConnector, type IngestFeature } from "@/lib/worldmodel/connector-framework";
import { db } from "@/lib/db";
import { emit } from "@/lib/worldmodel/event-bus";
import { GHANA_BOUNDS } from "@/lib/gdt/geo";

const STAC_API = "https://earth-search.aws.element84.com/v1";
const COLLECTION = "sentinel-1-grd";
const PAGE_LIMIT = 50;

// SAR polarizations we track (VV = vertical transmit/vertical receive, VH = vertical/horizontal)
const SAR_POLARIZATIONS = ["vv", "vh"];

// SAR-specific orbit info
const ORBIT_DIRECTIONS = ["ascending", "descending"];

export class Sentinel1SarConnector extends BaseConnector {
  readonly sourceId = "sentinel-1-grd";
  readonly name = "Sentinel-1 SAR GRD (STAC / Earth Search)";
  readonly live = true;
  retries = 2;

  private version = "";

  protected async fetch(): Promise<IngestFeature[]> {
    const bbox = [GHANA_BOUNDS.minLng, GHANA_BOUNDS.minLat, GHANA_BOUNDS.maxLng, GHANA_BOUNDS.maxLat];
    const now = new Date();
    const monthsBack = 2; // SAR has 6-day revisit (2 satellites), so 2 months is plenty
    let totalScenes = 0;

    for (let m = 0; m < monthsBack; m++) {
      const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1);

      const body = {
        collections: [COLLECTION],
        bbox,
        datetime: `${start.toISOString()}/${end.toISOString()}`,
        limit: PAGE_LIMIT,
        // Filter to IW (Interferometric Wide swath) mode — the standard mode over land
        query: {
          "sar:product_type": { eq: "GRD" },
          "sar:instrument_mode": { eq: "IW" },
        },
        fields: {
          exclude: ["assets"],
        },
      };

      try {
        const res = await fetch(`${STAC_API}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const features = data.features || [];

        for (const feat of features) {
          await persistSarScene(feat);
          totalScenes++;
        }
      } catch {
        // network errors are non-fatal — try next month
      }
    }

    emit.connectorCompleted("sentinel-1-grd", "Sentinel-1 SAR", totalScenes);
    return []; // scenes persisted directly, no Entity records needed
  }

  protected getVersion(): string {
    const now = new Date();
    this.version = this.version || `sar-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return this.version;
  }
}

/**
 * Persist a SAR scene to the RasterScene table.
 * SAR scenes are stored alongside optical scenes with sourceType="sentinel-1".
 */
async function persistSarScene(feat: any): Promise<void> {
  const props = feat.properties || {};
  const stacId = feat.id;
  if (!stacId) return;

  // Check if already exists
  const existing = await db.rasterScene.findUnique({ where: { stacId } }).catch(() => null);
  if (existing) return;

  const bbox = feat.bbox || [GHANA_BOUNDS.minLng, GHANA_BOUNDS.minLat, GHANA_BOUNDS.maxLng, GHANA_BOUNDS.maxLat];
  const geometry = feat.geometry;
  const centroidLng = (bbox[0] + bbox[2]) / 2;
  const centroidLat = (bbox[1] + bbox[3]) / 2;

  await db.rasterScene.create({
    data: {
      stacId,
      collection: COLLECTION,
      platform: "Sentinel-1",
      instrument: "C-SAR",
      constellation: "sentinel-1",
      geometryGeoJson: JSON.stringify(geometry || {}),
      centroidLng,
      centroidLat,
      minLng: bbox[0],
      minLat: bbox[1],
      maxLng: bbox[2],
      maxLat: bbox[3],
      mgrsTile: props.grid || "S1",
      datetime: new Date(props.datetime || props.start_datetime || Date.now()),
      cloudCover: 0, // SAR has no cloud — sees through them
      processingLevel: "GRD",
      gsd: 10, // 10m resolution for IW mode
      sourceId: "sentinel-1-grd",
      metadata: JSON.stringify({
        orbit: props["sat:orbit_state"] || "unknown",
        relativeOrbit: props["sat:relative_orbit"],
        instrumentMode: props["sar:instrument_mode"] || "IW",
        productType: props["sar:product_type"] || "GRD",
        resolution: props["sar:resolution"] || "10m",
        polarizations: SAR_POLARIZATIONS,
        incidenceAngle: props["sar:incidence_angle"],
      }),
    },
  }).catch(() => {
    // duplicate or schema mismatch — non-fatal
  });
}
