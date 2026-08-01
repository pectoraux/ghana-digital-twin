// Ghana Digital Twin — Ingestion Pipeline
// Download → Validate → Normalize → Transform → Version → Store → Index →
// Generate relationships → Publish event. Every stage is observable via onEvent.

import { db } from "@/lib/db";
import { upsertEntity } from "./../worldmodel/store";
import { inferRelationshipsFor, inferAllRelationships } from "./../worldmodel/relationships";
import { emit } from "./../worldmodel/event-bus";
import type { IngestFeature } from "./../worldmodel/connector-framework";
import type { PipelineEvent } from "./../worldmodel/types";
import { normalizeGeometry, computeBBox, computeCentroid } from "./../worldmodel/geometry";

export interface IngestInput {
  sourceId: string; // dataset sourceId ("geoboundaries", ...)
  sourceVersion: string;
  features: IngestFeature[];
  onEvent?: (e: PipelineEvent) => void;
}

export interface IngestOutput {
  written: number;
  relationshipCount: number;
}

class Pipeline {
  async ingest(input: IngestInput): Promise<IngestOutput> {
    const { sourceId, sourceVersion, features, onEvent } = input;
    const log = (e: PipelineEvent) => onEvent?.(e);
    const ts = () => new Date().toISOString();

    // resolve dataset source FK
    const ds = await db.datasetSource.findUnique({ where: { sourceId } });
    if (!ds) throw new Error(`DatasetSource not found: ${sourceId}`);

    // ---- Normalize ----
    const normalized = features
      .map((f) => {
        const geom = normalizeGeometry(f.geometry);
        if (!geom) return null;
        return { ...f, geometry: geom };
      })
      .filter((x): x is IngestFeature => x !== null);

    log({
      type: "DatasetNormalized",
      message: `Normalized ${normalized.length}/${features.length} features`,
      level: normalized.length < features.length ? "warn" : "info",
      sourceId,
      timestamp: ts(),
      payload: { normalized: normalized.length, dropped: features.length - normalized.length },
    });

    // ---- Transform + Version + Store + Index ----
    let written = 0;
    let created = 0;
    let versioned = 0;
    const ingestedIds: string[] = [];

    for (const f of normalized) {
      try {
        const result = await upsertEntity({
          externalId: f.externalId,
          kind: f.kind,
          name: f.name,
          geometry: f.geometry,
          attributes: f.attributes,
          tags: f.tags,
          confidence: f.confidence,
          sourceId: ds.id,
          sourceName: ds.name,
          sourceVersion,
          regionId: f.regionId ?? null,
        });
        written++;
        if (result.created) created++;
        if (result.versioned) versioned++;
        ingestedIds.push(result.entity.id);

        log({
          type: result.created ? "EntityCreated" : result.versioned ? "EntityVersionCreated" : "EntityUpdated",
          message: `${result.created ? "Created" : result.versioned ? "Versioned" : "Refreshed"}: ${f.name}`,
          level: "info",
          sourceId,
          entityId: result.entity.id,
          timestamp: ts(),
        });
      } catch (err) {
        log({
          type: "EntityUpdated",
          message: `Failed to upsert ${f.externalId}: ${String(err)}`,
          level: "warn",
          sourceId,
          timestamp: ts(),
        });
      }
    }

    log({
      type: "DatasetTransformed",
      message: `Stored ${written} entities (${created} new, ${versioned} versioned)`,
      level: "info",
      sourceId,
      timestamp: ts(),
      payload: { written, created, versioned },
    });

    // ---- Generate relationships (spatial) ----
    log({
      type: "RelationshipsUpdated",
      message: "Inferring spatial relationships…",
      level: "info",
      sourceId,
      timestamp: ts(),
    });

    let relationshipCount = 0;
    for (const id of ingestedIds) {
      try {
        const { getEntity } = await import("./../worldmodel/store");
        const entity = await getEntity(id);
        if (entity) relationshipCount += await inferRelationshipsFor(entity);
      } catch {
        /* skip */
      }
    }

    log({
      type: "RelationshipsUpdated",
      message: `Inferred ${relationshipCount} spatial relationships`,
      level: "info",
      sourceId,
      timestamp: ts(),
      payload: { count: relationshipCount },
    });

    // ---- Publish event ----
    emit.datasetDownloaded(sourceId, written);
    log({
      type: "DatasetUpdated",
      message: `Dataset ${ds.name} updated to v${sourceVersion}`,
      level: "info",
      sourceId,
      timestamp: ts(),
    });

    return { written, relationshipCount };
  }

  /** Rebuild all spatial relationships from scratch. */
  async rebuildRelationships(): Promise<number> {
    await db.relationship.deleteMany({});
    return inferAllRelationships();
  }
}

export const pipeline = new Pipeline();
