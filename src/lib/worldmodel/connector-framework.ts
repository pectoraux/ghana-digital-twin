// Ghana Digital Twin — Connector Framework
// Every connector: scheduled sync, metadata extraction, integrity validation,
// retries, version tracking, freshness monitoring, provenance, health, status,
// update history. New datasets are pluggable by implementing BaseConnector.

import { db } from "@/lib/db";
import { eventBus, emit } from "./event-bus";
import { DATASET_CATALOG } from "./catalog";
import type {
  DatasetSourceRecord,
  PipelineEvent,
  ConnectorStatus,
} from "./types";

// A normalized feature ready to be stored as an entity
export interface IngestFeature {
  externalId: string;
  kind: import("./types").EntityKind;
  name: string;
  geometry: GeoJSON.Geometry;
  attributes: Record<string, string | number | boolean>;
  tags: string[];
  confidence: number;
  regionId?: string | null;
}

export interface IngestResult {
  sourceId: string;
  features: IngestFeature[];
  sourceVersion: string;
  events: PipelineEvent[];
}

export abstract class BaseConnector {
  abstract readonly sourceId: string;
  abstract readonly name: string;
  /** Whether this connector fetches live data (true) or only registers metadata (false) */
  abstract readonly live: boolean;
  /** Max retry attempts on fetch failure */
  retries = 2;

  /** Fetch + normalize features into IngestFeature[]. Throw on unrecoverable error. */
  protected abstract fetch(): Promise<IngestFeature[]>;

  /** Current dataset version string (e.g. source release date). */
  protected abstract getVersion(): string | Promise<string>;

  // ---- Framework lifecycle ----
  async run(): Promise<ConnectorRunResult> {
    const runEvents: PipelineEvent[] = [];
    const startedAt = new Date();
    let recordsRead = 0;
    let recordsWritten = 0;

    // ensure DatasetSource row exists
    const dsRecord = DATASET_CATALOG.find((s) => s.sourceId === this.sourceId)!;
    const source = await this.ensureSource(dsRecord);
    await this.setSourceStatus("syncing");

    const run = await db.connectorRun.create({
      data: {
        sourceId: source.id,
        startedAt,
        status: "running",
        stage: "download",
        events: "[]",
      },
    });

    const log = (e: PipelineEvent) => {
      runEvents.push(e);
      eventBus.emit(e);
    };

    emit.connectorStarted(this.sourceId, this.name);
    log({
      type: "ConnectorStarted",
      message: `${this.name} sync started`,
      level: "info",
      sourceId: this.sourceId,
      timestamp: startedAt.toISOString(),
    });

    try {
      // ---- Download (with retries) ----
      let features: IngestFeature[] = [];
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          features = await this.fetch();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < this.retries) {
            log({
              type: "ConnectorFailed",
              message: `${this.name} fetch attempt ${attempt + 1} failed, retrying…`,
              level: "warn",
              sourceId: this.sourceId,
              timestamp: new Date().toISOString(),
              payload: { error: String(err), attempt: attempt + 1 },
            });
            await sleep(800 * (attempt + 1));
          }
        }
      }
      if (lastErr) throw lastErr;

      recordsRead = features.length;
      log({
        type: "DatasetDownloaded",
        message: `Downloaded ${features.length} features from ${this.name}`,
        level: "info",
        sourceId: this.sourceId,
        timestamp: new Date().toISOString(),
        payload: { count: features.length },
      });

      // ---- Validate ----
      const validated = features.filter(
        (f) => f.geometry && f.geometry.coordinates && f.geometry.type
      );
      if (validated.length < features.length) {
        log({
          type: "DatasetValidated",
          message: `Validation: dropped ${features.length - validated.length} invalid features`,
          level: "warn",
          sourceId: this.sourceId,
          timestamp: new Date().toISOString(),
          payload: { dropped: features.length - validated.length },
        });
      }
      features = validated;

      const sourceVersion = await this.getVersion();
      await db.datasetSource.update({
        where: { sourceId: this.sourceId },
        data: { version: sourceVersion, status: "syncing" },
      });
      await this.updateRun(run.id, { stage: "transform" });

      log({
        type: "DatasetValidated",
        message: `Validated ${features.length} features (version ${sourceVersion})`,
        level: "info",
        sourceId: this.sourceId,
        timestamp: new Date().toISOString(),
      });

      // Hand off to pipeline for transform/version/store/index/relationships
      const { pipeline } = await import("./../pipeline/pipeline");
      const { written, relationshipCount } = await pipeline.ingest({
        sourceId: this.sourceId,
        sourceVersion,
        features,
        onEvent: log,
      });
      recordsWritten = written;

      // ---- Success ----
      await this.setSourceStatus("healthy");
      await db.datasetSource.update({
        where: { sourceId: this.sourceId },
        data: {
          lastSyncAt: new Date(),
          lastSuccessAt: new Date(),
          status: "healthy",
        },
      });
      await this.refreshRecordCount();

      const finishedAt = new Date();
      await this.updateRun(run.id, {
        status: "success",
        stage: "complete",
        finishedAt,
        recordsRead,
        recordsWritten,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        events: JSON.stringify(runEvents),
      });

      emit.connectorCompleted(this.sourceId, this.name, written);
      return { success: true, recordsRead, recordsWritten, runEvents };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.setSourceStatus("degraded");
      const finishedAt = new Date();
      await this.updateRun(run.id, {
        status: "failed",
        stage: "failed",
        finishedAt,
        error: message,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        events: JSON.stringify(runEvents),
      });
      emit.connectorFailed(this.sourceId, this.name, message);
      log({
        type: "ConnectorFailed",
        message: `${this.name} failed: ${message}`,
        level: "error",
        sourceId: this.sourceId,
        timestamp: new Date().toISOString(),
        payload: { error: message },
      });
      return { success: false, recordsRead, recordsWritten, runEvents, error: message };
    }
  }

  private async ensureSource(rec: DatasetSourceRecord) {
    const existing = await db.datasetSource.findUnique({ where: { sourceId: rec.sourceId } });
    if (existing) return existing;
    return db.datasetSource.create({
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
        status: rec.status,
        metadata: JSON.stringify(rec.metadata ?? {}),
      },
    });
  }

  private async setSourceStatus(status: ConnectorStatus) {
    await db.datasetSource.update({
      where: { sourceId: this.sourceId },
      data: { status },
    });
  }

  private async refreshRecordCount() {
    const count = await db.entity.count({ where: { sourceName: this.name } });
    await db.datasetSource.update({
      where: { sourceId: this.sourceId },
      data: { recordCount: count },
    });
  }

  private async updateRun(
    runId: string,
    patch: Partial<{
      status: string;
      stage: string;
      finishedAt: Date;
      recordsRead: number;
      recordsWritten: number;
      durationMs: number;
      error: string;
      events: string;
    }>
  ) {
    await db.connectorRun.update({ where: { id: runId }, data: patch as never });
  }
}

export interface ConnectorRunResult {
  success: boolean;
  recordsRead: number;
  recordsWritten: number;
  runEvents: PipelineEvent[];
  error?: string;
}

// ---- Registry ----
const REGISTRY = new Map<string, () => BaseConnector>();

export function registerConnector(sourceId: string, factory: () => BaseConnector) {
  REGISTRY.set(sourceId, factory);
}

export function getConnector(sourceId: string): BaseConnector | null {
  const factory = REGISTRY.get(sourceId);
  return factory ? factory() : null;
}

export function listConnectors(): string[] {
  return Array.from(REGISTRY.keys());
}

// ---- Scheduler (in-process, triggerable) ----
export async function runConnector(sourceId: string): Promise<ConnectorRunResult> {
  const connector = getConnector(sourceId);
  if (!connector) throw new Error(`No connector registered for ${sourceId}`);
  return connector.run();
}

export async function runAllLiveConnectors(): Promise<ConnectorRunResult[]> {
  const ids = listConnectors();
  const results: ConnectorRunResult[] = [];
  for (const id of ids) {
    const c = getConnector(id)!;
    if (c.live) results.push(await c.run());
  }
  return results;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
