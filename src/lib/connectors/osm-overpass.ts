// Ghana Digital Twin — OpenStreetMap (Overpass) Connector (REAL data)
// Fetches live OSM features for Ghana: roads, railways, settlements, dams,
// bridges, and river/waterway networks via the Overpass API.

import { BaseConnector, type IngestFeature } from "./../worldmodel/connector-framework";
import { coerceToGeometry } from "./../worldmodel/geometry";
import type { EntityKind } from "./../worldmodel/types";
import { GHANA_BOUNDS } from "@/lib/gdt/geo";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Curated, real OSM queries for Ghana. Capped + regionalized to keep ingest
// reliable against Overpass rate limits and nationwide-query latency.
interface OsmQuery {
  tag: string;
  kind: EntityKind;
  cap: number;
  nameKey: string;
  bbox?: string; // override nationwide bbox (minLat,minLng,maxLat,maxLng)
}
const GHANA_BBOX_STR = `${GHANA_BOUNDS.minLat},${GHANA_BOUNDS.minLng},${GHANA_BOUNDS.maxLat},${GHANA_BOUNDS.maxLng}`;
// Western + Central region bbox (dense river network, mining belt of interest)
const WESTERN_BBOX = "4.9,-3.3,7.0,-1.0";

const QUERIES: OsmQuery[] = [
  // Roads (major network, nationwide)
  { tag: `way["highway"~"trunk|primary"]`, kind: "road", cap: 120, nameKey: "name" },
  // Rivers (regionalized — Western/Central belt, keeps query fast)
  { tag: `way["waterway"~"river|stream"]`, kind: "river", cap: 120, nameKey: "name", bbox: WESTERN_BBOX },
  // Settlements (places, nationwide)
  { tag: `node["place"~"city|town|village"]`, kind: "settlement", cap: 150, nameKey: "name" },
  // Dams (nationwide, few)
  { tag: `way["waterway"="dam"]`, kind: "dam", cap: 20, nameKey: "name" },
];

export class OsmOverpassConnector extends BaseConnector {
  readonly sourceId = "osm-overpass";
  readonly name = "OpenStreetMap (Overpass)";
  readonly live = true;
  retries = 2;

  private version = "";

  protected async fetch(): Promise<IngestFeature[]> {
    const features: IngestFeature[] = [];
    const osmTimestamp = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < QUERIES.length; i++) {
      const q = QUERIES[i];
      const bbox = q.bbox ?? GHANA_BBOX_STR;
      const overpassQl = `[out:json][timeout:60];(${q.tag}(${bbox}););out geom ${q.cap};`;
      let elements: any[] = [];
      let lastErr: unknown = null;

      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json",
              "User-Agent": "GhanaDigitalTwin/1.0 (geospatial world model)",
            },
            body: "data=" + encodeURIComponent(overpassQl),
            signal: AbortSignal.timeout(70000),
          });
          if (!res.ok) {
            lastErr = new Error(`Overpass ${endpoint} HTTP ${res.status}`);
            continue;
          }
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            elements = json.elements || [];
            lastErr = null;
          } catch {
            lastErr = new Error(`Overpass returned non-JSON (${text.slice(0, 60)})`);
            continue;
          }
          break;
        } catch (err) {
          lastErr = err;
          continue;
        }
      }
      if (lastErr && elements.length === 0) {
        // skip this query but continue others
        continue;
      }
      // small delay between queries to respect Overpass rate limits
      if (i < QUERIES.length - 1) await sleep(2500);

      for (const el of elements) {
        const tags = el.tags || {};
        const name = tags[q.nameKey] || tags["ref"] || defaultName(q.kind, el.id);
        const geom = elementToGeometry(el);
        if (!geom) continue;

        const attrs: Record<string, string | number | boolean> = {
          osmType: el.type,
          osmId: el.id,
        };
        // surface relevant tags
        if (tags.highway) attrs.highway = tags.highway;
        if (tags.waterway) attrs.waterway = tags.waterway;
        if (tags.railway) attrs.railway = tags.railway;
        if (tags.place) attrs.place = tags.place;
        if (tags.population) attrs.population = Number(tags.population);
        if (tags.lanes) attrs.lanes = Number(tags.lanes);
        if (tags.surface) attrs.surface = tags.surface;
        if (tags.bridge) attrs.bridge = tags.bridge;
        if (tags.tunnel) attrs.tunnel = tags.tunnel;

        const tagsList = Object.keys(tags).slice(0, 8);

        features.push({
          externalId: `osm:${el.type}:${el.id}`,
          kind: q.kind,
          name,
          geometry: geom,
          attributes: attrs,
          tags: tagsList,
          confidence: 0.95,
        });
      }
    }

    this.version = `osm-${osmTimestamp}`;
    return features;
  }

  protected async getVersion(): Promise<string> {
    return this.version;
  }
}

// Convert an Overpass element (with `geometry` array for ways, or lat/lon for nodes) to GeoJSON
function elementToGeometry(el: any): GeoJSON.Geometry | null {
  if (el.type === "node" && typeof el.lon === "number" && typeof el.lat === "number") {
    return { type: "Point", coordinates: [el.lon, el.lat] };
  }
  if (el.type === "way" && Array.isArray(el.geometry)) {
    const coords = el.geometry
      .filter((p: any) => typeof p.lon === "number" && typeof p.lat === "number")
      .map((p: any) => [p.lon, p.lat]);
    if (coords.length < 2) return null;
    return { type: "LineString", coordinates: coords };
  }
  if (el.type === "relation" && Array.isArray(el.members)) {
    // best-effort: take first way geometry
    for (const m of el.members) {
      if (m.geometry && Array.isArray(m.geometry)) {
        const coords = m.geometry
          .filter((p: any) => typeof p.lon === "number")
          .map((p: any) => [p.lon, p.lat]);
        if (coords.length >= 2) return { type: "LineString", coordinates: coords };
      }
    }
  }
  return null;
}

function defaultName(kind: EntityKind, id: number): string {
  const labels: Record<EntityKind, string> = {
    road: "Road",
    railway: "Railway",
    river: "Waterway",
    dam: "Dam",
    bridge: "Bridge",
    settlement: "Settlement",
    lake: "Lake",
    watershed: "Watershed",
    forest: "Forest",
    protected_area: "Protected Area",
    administrative_boundary: "Boundary",
    water_body: "Water Body",
    terrain_feature: "Terrain Feature",
    land_cover_region: "Land Cover",
  };
  return `${labels[kind] ?? kind} ${id}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
