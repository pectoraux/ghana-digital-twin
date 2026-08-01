// Ghana Digital Twin — Multi-Modal Modality Registry
// Tracks which sensing modalities are available and what features they contribute.
// Enables fusion across optical, SAR, thermal, weather, DEM, hydrology, infrastructure, human activity.

import { db } from "@/lib/db";

export interface ModalityDef {
  modalityId: string;
  name: string;
  category: string;
  sensor?: string;
  platform?: string;
  resolution?: string;
  cadence?: string;
  featuresProvided: string[];
  description: string;
}

// The canonical modality registry — all sensing modalities the platform can fuse
export const MODALITIES: ModalityDef[] = [
  {
    modalityId: "sentinel-2-optical",
    name: "Sentinel-2 Optical (MSI)",
    category: "optical",
    sensor: "MSI",
    platform: "Sentinel-2A/B",
    resolution: "10m",
    cadence: "5 days",
    featuresProvided: ["ndvi", "ndwi", "nbr", "evi", "bsi", "mndwi", "savi"],
    description: "Multispectral optical imagery. Primary source for vegetation, water, and bare soil indices. Limited by clouds.",
  },
  {
    modalityId: "sentinel-1-sar",
    name: "Sentinel-1 SAR (C-band)",
    category: "sar",
    sensor: "C-SAR",
    platform: "Sentinel-1A/B",
    resolution: "10-20m",
    cadence: "6 days",
    featuresProvided: ["sarBackscatter", "sarCoherence", "sarRoughness"],
    description: "Synthetic Aperture Radar. Sees through clouds. Detects surface disturbance, excavation, moisture, and flooding. Critical for rainy season coverage.",
  },
  {
    modalityId: "landsat-thermal",
    name: "Landsat Thermal (TIRS)",
    category: "thermal",
    sensor: "TIRS",
    platform: "Landsat-8/9",
    resolution: "30m",
    cadence: "8 days",
    featuresProvided: ["thermalAnomaly"],
    description: "Thermal infrared. Detects heat anomalies, machinery, kilns, processing sites, and burn areas. Complements optical burn detection.",
  },
  {
    modalityId: "chirps-weather",
    name: "CHIRPS Rainfall",
    category: "weather",
    resolution: "5km",
    cadence: "Daily",
    featuresProvided: ["rainfall7d", "rainfallAnomaly"],
    description: "Daily rainfall. Explains water body changes, turbidity, and seasonal vegetation patterns. Reduces false positives during rainy season.",
  },
  {
    modalityId: "era5-atmospheric",
    name: "ERA5 Reanalysis",
    category: "weather",
    platform: "ECMWF",
    resolution: "31km",
    cadence: "Hourly",
    featuresProvided: ["temperature", "soilMoisture"],
    description: "Atmospheric reanalysis: temperature, humidity, soil moisture, wind. Environmental context for change attribution.",
  },
  {
    modalityId: "srtm-dem",
    name: "SRTM Digital Elevation",
    category: "dem",
    sensor: "SRTM",
    resolution: "30m",
    cadence: "Static",
    featuresProvided: ["elevation", "slope", "aspect", "flowAccumulation", "erosionSusceptibility"],
    description: "Elevation model. Derives slope, aspect, flow accumulation, and erosion susceptibility. Explains where disturbance is likely to cause downstream impact.",
  },
  {
    modalityId: "hydrosheds-hydrology",
    name: "HydroSHEDS",
    category: "hydrology",
    resolution: "15 arc-sec",
    cadence: "Static",
    featuresProvided: ["distanceToRiver", "riverProximity", "downstreamConnected"],
    description: "River networks and watersheds. Derives distance to rivers, river proximity, and downstream connectivity. Critical for mining and flood hypotheses.",
  },
  {
    modalityId: "nightlights-human",
    name: "Nighttime Lights (VIIRS)",
    category: "human_activity",
    sensor: "VIIRS",
    platform: "Suomi-NPP / NOAA-20",
    resolution: "500m",
    cadence: "Monthly",
    featuresProvided: ["nightLights", "builtUpIndex"],
    description: "Nighttime lights. Reveals settlement expansion, industrial activity, mining camps, and infrastructure development.",
  },
  {
    modalityId: "worldpop-population",
    name: "WorldPop Population",
    category: "human_activity",
    resolution: "100m",
    cadence: "Annual",
    featuresProvided: ["populationDensity", "settlementGrowthRate"],
    description: "Gridded population estimates. Provides population context for impact assessment and settlement expansion tracking.",
  },
];

/**
 * Ensure all modalities are registered in the database.
 */
export async function ensureModalitiesRegistered(): Promise<void> {
  for (const m of MODALITIES) {
    const existing = await db.modalitySource.findUnique({ where: { modalityId: m.modalityId } });
    if (existing) {
      await db.modalitySource.update({
        where: { modalityId: m.modalityId },
        data: {
          name: m.name,
          category: m.category,
          sensor: m.sensor ?? null,
          platform: m.platform ?? null,
          resolution: m.resolution ?? null,
          cadence: m.cadence ?? null,
          featuresProvided: JSON.stringify(m.featuresProvided),
          description: m.description,
        },
      });
    } else {
      await db.modalitySource.create({
        data: {
          modalityId: m.modalityId,
          name: m.name,
          category: m.category,
          sensor: m.sensor ?? null,
          platform: m.platform ?? null,
          resolution: m.resolution ?? null,
          cadence: m.cadence ?? null,
          featuresProvided: JSON.stringify(m.featuresProvided),
          description: m.description,
          status: m.modalityId === "sentinel-2-optical" ? "active" : "registered",
          coveragePct: m.modalityId === "sentinel-2-optical" ? 100 : 0,
        },
      });
    }
  }
}

export async function getModalities(): Promise<any[]> {
  await ensureModalitiesRegistered();
  const rows = await db.modalitySource.findMany({ orderBy: { category: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    modalityId: r.modalityId,
    name: r.name,
    category: r.category,
    sensor: r.sensor,
    platform: r.platform,
    resolution: r.resolution,
    cadence: r.cadence,
    status: r.status,
    featuresProvided: JSON.parse(r.featuresProvided || "[]"),
    coveragePct: r.coveragePct,
    lastDataAt: r.lastDataAt instanceof Date ? r.lastDataAt.toISOString() : r.lastDataAt,
    description: r.description,
  }));
}

export async function getModalityStats(): Promise<any> {
  await ensureModalitiesRegistered();
  const modalities = await db.modalitySource.findMany();
  const byCategory: Record<string, number> = {};
  let active = 0;
  for (const m of modalities) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    if (m.status === "active") active++;
  }
  return {
    total: modalities.length,
    active,
    registered: modalities.length - active,
    categories: Object.keys(byCategory).length,
    byCategory,
  };
}
