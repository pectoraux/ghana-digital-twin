// Ghana Digital Twin — geoBoundaries Connector (REAL data)
// Fetches authoritative administrative boundaries for Ghana (ADM1 regions,
// ADM2 districts) from the geoBoundaries API. Live data, full provenance.

import { BaseConnector, type IngestFeature } from "./../worldmodel/connector-framework";
import { coerceToGeometry } from "./../worldmodel/geometry";
import type { EntityKind } from "./../worldmodel/types";

const ADM_LEVELS = [
  { level: "ADM1", kind: "administrative_boundary" as EntityKind, regionAttr: "shapeName" },
];

export class GeoBoundariesConnector extends BaseConnector {
  readonly sourceId = "geoboundaries";
  readonly name = "geoBoundaries (GHA)";
  readonly live = true;
  retries = 2;

  private version = "";

  protected async fetch(): Promise<IngestFeature[]> {
    const features: IngestFeature[] = [];

    for (const { level, kind } of ADM_LEVELS) {
      // 1. fetch metadata (gives download URL)
      const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/GHA/${level}/`;
      const metaRes = await fetch(metaUrl, { signal: AbortSignal.timeout(20000) });
      if (!metaRes.ok) throw new Error(`geoBoundaries meta ${level} HTTP ${metaRes.status}`);
      const meta = await metaRes.json();
      const gjUrl = meta.gjDownloadURL as string;
      if (!gjUrl) throw new Error(`geoBoundaries ${level}: no gjDownloadURL`);
      this.version = `${meta.boundaryYearRepresented ?? meta.buildDate ?? "latest"}-${level}`;

      // 2. download GeoJSON
      const gjRes = await fetch(gjUrl, { signal: AbortSignal.timeout(60000) });
      if (!gjRes.ok) throw new Error(`geoBoundaries geojson ${level} HTTP ${gjRes.status}`);
      const fc = await gjRes.json();

      if (!fc.features || !Array.isArray(fc.features)) continue;

      for (const f of fc.features) {
        const props = f.properties || {};
        const name =
          props.shapeName ||
          props.shapeISO ||
          `${level}-${props.shapeID || features.length}`;
        const geom = coerceToGeometry(f.geometry ?? f);
        if (!geom) continue;

        // Map region name → our region id where possible
        const regionId = matchRegionId(props.shapeName);

        features.push({
          externalId: `geoboundaries:${level}:${props.shapeID || props.shapeISO || name}`,
          kind,
          name,
          geometry: geom,
          attributes: {
            boundaryLevel: level,
            shapeISO: props.shapeISO ?? "",
            shapeType: props.shapeType ?? "",
            boundarySource: meta.boundarySource ?? "geoBoundaries",
            sourceDataUpdate: props.sourceDataUpdateDate ?? meta.sourceDataUpdateDate ?? "",
          },
          tags: ["administrative", level.toLowerCase(), "ghana"],
          confidence: 0.98,
          regionId,
        });
      }
    }

    return features;
  }

  protected async getVersion(): Promise<string> {
    return this.version || `adm-${new Date().toISOString().slice(0, 10)}`;
  }
}

// Map geoBoundaries region names to our internal region ids
const REGION_NAME_MAP: Record<string, string> = {
  "Greater Accra": "gar",
  "Ashanti": "ash",
  "Western": "wst",
  "Western North": "wnr",
  "Central": "cen",
  "Eastern": "est",
  "Volta": "vol",
  "Oti": "oti",
  "Bono": "bon",
  "Bono East": "bne",
  "Ahafo": "aha",
  "Northern": "nor",
  "Savannah": "sav",
  "North East": "ner",
  "Upper East": "upe",
  "Upper West": "upw",
};

function matchRegionId(name?: string): string | null {
  if (!name) return null;
  return REGION_NAME_MAP[name] ?? null;
}
