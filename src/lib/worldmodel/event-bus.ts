// Ghana Digital Twin — Event Bus
// In-process pub/sub for pipeline + connector events. Persists every event to
// the IngestionEvent table (provenance + observability) and notifies live subscribers.

import { db } from "@/lib/db";
import type { PipelineEvent } from "./types";

type Subscriber = (event: PipelineEvent) => void;

class EventBus {
  private subscribers = new Set<Subscriber>();
  private recent: PipelineEvent[] = [];
  private maxRecent = 200;

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /** Emit + persist an event. Fire-and-forget persistence. */
  async emit(event: PipelineEvent): Promise<void> {
    // notify live subscribers
    for (const s of this.subscribers) {
      try {
        s(event);
      } catch {
        /* ignore subscriber errors */
      }
    }
    // keep recent in-memory ring for quick reads
    this.recent.unshift(event);
    if (this.recent.length > this.maxRecent) this.recent.length = this.maxRecent;

    // persist (best-effort; DB may not be ready during seed)
    try {
      await db.ingestionEvent.create({
        data: {
          type: event.type,
          sourceId: event.sourceId ?? null,
          entityId: event.entityId ?? null,
          message: event.message,
          level: event.level,
          payload: JSON.stringify(event.payload ?? {}),
        },
      });
    } catch {
      /* DB unavailable — event still emitted to live subscribers */
    }
  }

  /** Convenience helper */
  emitNow(
    type: PipelineEvent["type"],
    message: string,
    opts: Partial<PipelineEvent> = {}
  ): Promise<void> {
    return this.emit({
      type,
      message,
      level: opts.level ?? "info",
      sourceId: opts.sourceId,
      entityId: opts.entityId,
      payload: opts.payload,
      timestamp: new Date().toISOString(),
    });
  }

  recentEvents(limit = 50): PipelineEvent[] {
    return this.recent.slice(0, limit);
  }
}

export const eventBus = new EventBus();

// Convenience emitters
export const emit = {
  connectorStarted: (sourceId: string, name: string) =>
    eventBus.emitNow("ConnectorStarted", `Connector started: ${name}`, { sourceId }),
  connectorCompleted: (sourceId: string, name: string, written: number) =>
    eventBus.emitNow("ConnectorCompleted", `Connector completed: ${name} (${written} entities)`, {
      sourceId,
      payload: { written },
    }),
  connectorFailed: (sourceId: string, name: string, error: string) =>
    eventBus.emitNow("ConnectorFailed", `Connector failed: ${name} — ${error}`, {
      sourceId,
      level: "error",
      payload: { error },
    }),
  datasetDownloaded: (sourceId: string, count: number) =>
    eventBus.emitNow("DatasetDownloaded", `Downloaded ${count} features`, {
      sourceId,
      payload: { count },
    }),
  entityCreated: (sourceId: string, entityId: string, name: string) =>
    eventBus.emitNow("EntityCreated", `Entity created: ${name}`, { sourceId, entityId }),
  relationshipsUpdated: (sourceId: string, count: number) =>
    eventBus.emitNow("RelationshipsUpdated", `Inferred ${count} spatial relationships`, {
      sourceId,
      payload: { count },
    }),
};
