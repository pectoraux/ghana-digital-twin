// Ghana Digital Twin — STAC Connector (REAL Sentinel-2 imagery)
// Fetches real satellite scene metadata from the Element 84 Earth Search STAC API
// (real Sentinel-2 L2A COGs hosted on AWS). Stores footprints, cloud %, bands,
// COG URLs. This is the real raster catalog — no placeholders.

import { BaseConnector, type IngestFeature } from "@/lib/worldmodel/connector-framework";
import { db } from "@/lib/db";
import { coerceToGeometry, computeBBox, computeCentroid } from "@/lib/worldmodel/geometry";
import { emit } from "@/lib/worldmodel/event-bus";
import { GHANA_BOUNDS } from "@/lib/gdt/geo";

const STAC_API = "https://earth-search.aws.element84.com/v1";
const COLLECTION = "sentinel-2-l2a";
const MAX_CLOUD = 40;
const PAGE_LIMIT = 50;

// Bands we persist (COG URLs for spectral index computation)
const BANDS_TO_STORE = ["red", "nir", "green", "blue", "swir16", "swir22", "rededge1", "scl", "visual"];

export class StacSentinel2Connector extends BaseConnector {
  readonly sourceId = "stac-sentinel-2";
  readonly name = "Sentinel-2 L2A (STAC / Earth Search)";
  readonly live = true;
  retries = 2;

  private version = "";

  protected async fetch(): Promise<IngestFeature[]> {
    // STAC scenes aren't stored as world-model Entity records — they're stored
    // directly in the RasterScene table. We use the connector framework for
    // orchestration/health/provenance but write scenes directly here.
    // Return empty IngestFeature[] so the pipeline store step is a no-op;
    // actual scene persistence happens in this fetch().

    const bbox = [GHANA_BOUNDS.minLng, GHANA_BOUNDS.minLat, GHANA_BOUNDS.maxLng, GHANA_BOUNDS.maxLat];
    // Last ~120 days of imagery, chunked by month to respect STAC page limits
    const now = new Date();
    const monthsBack = 4;
    let totalScenes = 0;

    for (let m = 0; m < monthsBack; m++) {
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (m + 1), 1));
      const datetime = `${start.toISOString()}/${end.toISOString()}`;

      // paginated search
      let nextToken: string | null = null;
      for (let page = 0; page < 4; page++) {
        const body: any = {
          collections: [COLLECTION],
          bbox,
          datetime,
          query: { "eo:cloud_cover": { lt: MAX_CLOUD } },
          limit: PAGE_LIMIT,
          fields: {
            include: [
              "id", "type", "geometry", "properties.datetime", "properties.eo:cloud_cover",
              "properties.platform", "properties.instruments", "properties.constellation",
              "properties.grid:code", "properties.gsd", "properties.view:sun_azimuth",
              "properties.view:sun_elevation", "assets", "links",
            ],
          },
        };
        if (nextToken) body.next = nextToken;

        const res = await fetch(`${STAC_API}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) throw new Error(`STAC search HTTP ${res.status}`);
        const fc = await res.json();
        const features = fc.features || [];
        if (features.length === 0) break;

        for (const f of features) {
          await persistScene(f, this.sourceId);
          totalScenes++;
        }
        emit.datasetDownloaded(this.sourceId, totalScenes);

        nextToken = fc.links?.find((l: any) => l.rel === "next")?.body?.next ?? null;
        if (!nextToken) break;
      }
    }

    this.version = `sentinel-2-l2a-${now.toISOString().slice(0, 10)}`;
    // update the dataset source record count to reflect scenes
    const sceneCount = await db.rasterScene.count({ where: { sourceId: this.sourceId } });
    await db.datasetSource.update({
      where: { sourceId: this.sourceId },
      data: { recordCount: sceneCount, version: this.version },
    });
    emit.datasetIndexed(this.sourceId, sceneCount);
    emit.worldModelUpdated(this.sourceId, sceneCount);
    // Return empty — scenes persisted directly (not as world-model entities)
    return [];
  }

  protected async getVersion(): Promise<string> {
    return this.version || `stac-${new Date().toISOString().slice(0, 10)}`;
  }
}

async function persistScene(feature: any, sourceId: string) {
  const stacId = feature.id as string;
  const props = feature.properties || {};
  const geom = coerceToGeometry(feature.geometry);
  if (!geom) return;

  const bbox = computeBBox(geom);
  const centroid = computeCentroid(geom);
  const datetime = new Date(props.datetime);
  const cloud = props["eo:cloud_cover"];
  const mgrs = props["grid:code"]?.replace("MGRS-", "");
  const platform = props.platform;
  const instrument = props.instruments?.[0];
  const constellation = props.constellation;
  const gsd = props.gsd ?? 10;
  const selfHref = feature.links?.find((l: any) => l.rel === "self")?.href;

  // extra metadata
  const metadata: Record<string, any> = {
    view_sunAzimuth: props["view:sun_azimuth"],
    view_sunElevation: props["view:sun_elevation"],
  };

  const scene = await db.rasterScene.upsert({
    where: { stacId },
    update: {
      cloudCover: cloud,
      metadata: JSON.stringify(metadata),
    },
    create: {
      stacId,
      collection: COLLECTION,
      platform,
      instrument,
      constellation,
      geometryGeoJson: JSON.stringify(geom),
      centroidLng: centroid[0],
      centroidLat: centroid[1],
      minLng: bbox.minLng,
      minLat: bbox.minLat,
      maxLng: bbox.maxLng,
      maxLat: bbox.maxLat,
      mgrsTile: mgrs,
      datetime,
      cloudCover: cloud,
      processingLevel: "L2A",
      gsd,
      sourceId,
      stacVersion: feature.stac_version || "1.0.0",
      selfHref,
      metadata: JSON.stringify(metadata),
    },
  });

  // persist bands (real COG URLs)
  const assets = feature.assets || {};
  for (const bandName of BANDS_TO_STORE) {
    const asset = assets[bandName];
    if (!asset?.href) continue;
    await db.rasterBand.upsert({
      where: { sceneId_name: { sceneId: scene.id, name: bandName } },
      update: {
        href: asset.href,
        type: asset.type,
        roles: JSON.stringify(asset.roles || []),
        gsd: asset.gsd,
        shapeW: asset["proj:shape"]?.[0],
        shapeH: asset["proj:shape"]?.[1],
        bandMetadata: JSON.stringify(asset["eo:bands"]?.[0] || {}),
      },
      create: {
        sceneId: scene.id,
        name: bandName,
        commonName: bandName,
        displayName: bandName.toUpperCase(),
        href: asset.href,
        type: asset.type,
        roles: JSON.stringify(asset.roles || []),
        gsd: asset.gsd,
        shapeW: asset["proj:shape"]?.[0],
        shapeH: asset["proj:shape"]?.[1],
        bandMetadata: JSON.stringify(asset["eo:bands"]?.[0] || {}),
      },
    });
  }
}
