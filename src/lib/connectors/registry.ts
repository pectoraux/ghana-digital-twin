// Ghana Digital Twin — Connector Registry
// Registers all connectors (live + metadata-only). Ensures every dataset in the
// catalog has a DatasetSource row (provenance + health), even if bulk ingest
// requires offline tooling.

import { db } from "@/lib/db";
import {
  registerConnector,
  BaseConnector,
} from "./../worldmodel/connector-framework";
import { DATASET_CATALOG } from "./../worldmodel/catalog";
import { GeoBoundariesConnector } from "./geoboundaries";
import { OsmOverpassConnector } from "./osm-overpass";
import { StacSentinel2Connector } from "./stac-sentinel2";
import { MiningCadastreConnector } from "./mining-cadastre";
import { ChirpsRainfallConnector } from "./chirps-rainfall";
import { Sentinel1SarConnector } from "./sentinel1-sar";
import { DemTerrainConnector } from "./dem-terrain";

// ---- Register live connectors ----
registerConnector("geoboundaries", () => new GeoBoundariesConnector());
registerConnector("osm-overpass", () => new OsmOverpassConnector());
registerConnector("stac-sentinel-2", () => new StacSentinel2Connector());
// Phase 1.6: Missing sensors that populate evidence categories
registerConnector("mining-cadastre-gha", () => new MiningCadastreConnector());
registerConnector("chirps-rainfall", () => new ChirpsRainfallConnector());
registerConnector("sentinel-1-grd", () => new Sentinel1SarConnector());
registerConnector("dem-terrain-gha", () => new DemTerrainConnector());

// ---- Metadata-only connectors (register provenance; no live fetch) ----
// These datasets require offline bulk ingest (raster tiles, large extracts).
// We register them so the platform knows they exist, their license, freshness
// status, and can be activated when offline data is staged.

class MetadataConnector extends BaseConnector {
  readonly live = false;
  constructor(
    readonly sourceId: string,
    readonly name: string,
    private versionStr: string
  ) {
    super();
  }
  protected async fetch() {
    return []; // no live fetch; provenance only
  }
  protected async getVersion() {
    return this.versionStr;
  }
}

const METADATA_DATASETS: { sourceId: string; name: string; version: string }[] = [
  { sourceId: "gadm", name: "GADM Ghana", version: "v4.1" },
  { sourceId: "naturalearth", name: "Natural Earth", version: "v5.1.2" },
  { sourceId: "hydrosheds", name: "HydroSHEDS", version: "v1.0" },
  { sourceId: "hydrorivers", name: "HydroRIVERS", version: "v1.0" },
  { sourceId: "jrc-gsw", name: "JRC Global Surface Water", version: "v1.4" },
  { sourceId: "copernicus-dem", name: "Copernicus DEM GLO-30", version: "2021.1" },
  { sourceId: "srtm", name: "SRTM", version: "v3.0" },
  { sourceId: "esa-worldcover", name: "ESA WorldCover", version: "v300-2021" },
  { sourceId: "dynamic-world", name: "Dynamic World", version: "v1" },
  { sourceId: "hansen-gfc", name: "Global Forest Change (Hansen)", version: "v1.10" },
  { sourceId: "wdpa", name: "WDPA Protected Areas", version: "monthly" },
  { sourceId: "ghsl", name: "GHSL", version: "R2023A" },
  { sourceId: "worldpop", name: "WorldPop", version: "2023" },
  { sourceId: "chirps", name: "CHIRPS Rainfall", version: "v2.0" },
  { sourceId: "era5", name: "ERA5 Reanalysis", version: "monthly" },
];

for (const m of METADATA_DATASETS) {
  registerConnector(m.sourceId, () => new MetadataConnector(m.sourceId, m.name, m.version));
}

/** Ensure every catalog dataset has a DatasetSource row (provenance). */
export async function ensureAllSourcesRegistered(): Promise<void> {
  for (const rec of DATASET_CATALOG) {
    const existing = await db.datasetSource.findUnique({ where: { sourceId: rec.sourceId } });
    if (existing) {
      // refresh metadata fields but preserve runtime status/counters
      await db.datasetSource.update({
        where: { sourceId: rec.sourceId },
        data: {
          name: rec.name,
          category: rec.category,
          provider: rec.provider,
          license: rec.license,
          resolution: rec.resolution,
          cadence: rec.cadence,
          coverage: rec.coverage,
          description: rec.description,
          storageType: rec.storageType,
        },
      });
    } else {
      await db.datasetSource.create({
        data: {
          sourceId: rec.sourceId,
          name: rec.name,
          category: rec.category,
          provider: rec.provider,
          license: rec.license,
          resolution: rec.resolution,
          cadence: rec.cadence,
          coverage: rec.coverage,
          description: rec.description,
          storageType: rec.storageType,
          status: rec.storageType === "raster" ? "pending" : "pending",
          metadata: JSON.stringify(rec.metadata ?? {}),
        },
      });
    }
  }
}

export { BaseConnector };
