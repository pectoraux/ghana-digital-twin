// Ghana Digital Twin — Observation Lineage
// Traces the full provenance chain: Observation → Evidence → Raster Product →
// Baseline → Sentinel Scene → COG Band URLs → STAC Item. Enables audit and
// scientific trust — users can drill all the way back to the original satellite data.

import { db } from "@/lib/db";

export interface LineageNode {
  level: string; // "observation" | "evidence" | "raster_product" | "baseline" | "scene" | "cog" | "stac_item"
  id: string;
  label: string;
  type: string;
  details: Record<string, any>;
  children?: LineageNode[];
}

export async function buildObservationLineage(observationId: string): Promise<LineageNode | null> {
  const obs = await db.observation.findUnique({
    where: { id: observationId },
    include: {
      evidenceLinks: { include: { evidence: true } },
    },
  });
  if (!obs) return null;

  // evidence children
  const evidenceChildren: LineageNode[] = [];
  for (const link of obs.evidenceLinks) {
    const ev = link.evidence;
    const evNode: LineageNode = {
      level: "evidence",
      id: ev.id,
      label: `${ev.productType.replace(/_/g, " ")} (signal ${(ev.normalizedSignal * 100).toFixed(0)}%)`,
      type: ev.productType,
      details: {
        uuid: ev.uuid,
        value: ev.value,
        normalizedSignal: ev.normalizedSignal,
        confidence: ev.confidence,
        uncertainty: ev.uncertainty,
        direction: ev.direction,
        description: ev.description,
        observedAt: ev.observedAt instanceof Date ? ev.observedAt.toISOString() : ev.observedAt,
        weight: link.weight,
        contribution: link.contribution,
      },
      children: [],
    };

    // raster product child
    if (ev.productId) {
      const product = await db.rasterProduct.findUnique({
        where: { id: ev.productId },
        select: { id: true, type: true, indexName: true, formula: true, confidence: true, baselineId: true, sceneId: true, mgrsTile: true },
      });
      if (product) {
        const productNode: LineageNode = {
          level: "raster_product",
          id: product.id,
          label: `${product.type} (${product.indexName ?? "—"})`,
          type: product.type,
          details: {
            formula: product.formula,
            confidence: product.confidence,
            mgrsTile: product.mgrsTile,
          },
          children: [],
        };

        // baseline child
        if (product.baselineId) {
          const baseline = await db.seasonalBaseline.findUnique({
            where: { id: product.baselineId },
            select: { id: true, indexName: true, mgrsTile: true, season: true, sampleCount: true, uncertainty: true },
          });
          if (baseline) {
            productNode.children!.push({
              level: "baseline",
              id: baseline.id,
              label: `Seasonal baseline: ${baseline.indexName} ${baseline.season} (${baseline.sampleCount} scenes)`,
              type: "baseline",
              details: {
                indexName: baseline.indexName,
                mgrsTile: baseline.mgrsTile,
                season: baseline.season,
                sampleCount: baseline.sampleCount,
                uncertainty: baseline.uncertainty,
              },
              children: [],
            });
          }
        }

        // scene child
        if (product.sceneId || ev.supportingSceneId) {
          const sceneId = ev.supportingSceneId ?? product.sceneId;
          if (sceneId) {
            const scene = await db.rasterScene.findUnique({
              where: { id: sceneId },
              include: { bands: { select: { name: true, href: true } } },
            });
            if (scene) {
              const sceneNode: LineageNode = {
                level: "scene",
                id: scene.id,
                label: scene.stacId,
                type: "sentinel-2-scene",
                details: {
                  stacId: scene.stacId,
                  datetime: scene.datetime instanceof Date ? scene.datetime.toISOString() : scene.datetime,
                  cloudCover: scene.cloudCover,
                  mgrsTile: scene.mgrsTile,
                  platform: scene.platform,
                },
                children: [],
              };

              // COG band children
              for (const band of scene.bands.slice(0, 6)) {
                sceneNode.children!.push({
                  level: "cog",
                  id: band.href,
                  label: `${band.name} (COG)`,
                  type: "cloud-optimized-geotiff",
                  details: {
                    href: band.href,
                    commonName: band.commonName,
                  },
                  children: [],
                });
              }

              // STAC item link
              sceneNode.children!.push({
                level: "stac_item",
                id: scene.stacId,
                label: `STAC Item: ${scene.stacId}`,
                type: "stac-item",
                details: {
                  stacId: scene.stacId,
                  collection: scene.collection,
                  selfHref: scene.selfHref,
                  stacVersion: scene.stacVersion,
                },
                children: [],
              });

              productNode.children!.push(sceneNode);
            }
          }
        }

        evNode.children!.push(productNode);
      }
    }

    evidenceChildren.push(evNode);
  }

  return {
    level: "observation",
    id: obs.id,
    label: `${obs.type.replace(/_/g, " ")} (${(obs.confidence * 100).toFixed(0)}% conf)`,
    type: obs.type,
    details: {
      uuid: obs.uuid,
      title: obs.title,
      confidence: obs.confidence,
      uncertainty: obs.uncertainty,
      severity: obs.severity,
      areaHa: obs.areaHa,
      observedAt: obs.observedAt instanceof Date ? obs.observedAt.toISOString() : obs.observedAt,
      evidenceCount: obs.evidenceLinks.length,
    },
    children: evidenceChildren,
  };
}
