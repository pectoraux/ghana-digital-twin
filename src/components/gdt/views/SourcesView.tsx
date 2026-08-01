"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Activity,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  Zap,
  Server,
  Layers,
  Loader2,
  Radio,
  FileBox,
  Play,
} from "lucide-react";
import {
  fetchConnectors,
  fetchHealth,
  triggerSync,
  triggerSyncAll,
  useAsync,
  type ConnectorInfo,
} from "@/lib/gdt/api";
import { SOURCE_STATUS_META, timeAgo } from "@/lib/gdt/format";
import { useGDT } from "@/lib/gdt/store";
import { MetricStat, SectionLabel, Sparkline } from "@/components/gdt/atoms";

// ---- inline formatting helpers ----

function fmtRecords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

// Map status → color, extending SOURCE_STATUS_META with `pending` → zinc.
function statusColor(status: string): string {
  if (status === "pending") return "#71717a";
  return SOURCE_STATUS_META[status as keyof typeof SOURCE_STATUS_META]?.color ?? "#71717a";
}

function statusLabel(status: string): string {
  if (status === "pending") return "Pending";
  return SOURCE_STATUS_META[status as keyof typeof SOURCE_STATUS_META]?.label ?? status;
}

// Freshness derived from lastSyncAt: fresh = 100, stale → lower (log scale).
function freshnessFromLastSync(lastSyncAt: string | null): number {
  if (!lastSyncAt) return 0;
  const min = (Date.now() - new Date(lastSyncAt).getTime()) / 60000;
  if (min < 0) return 100;
  const v = 100 - Math.log10(Math.max(1, min)) * 30;
  return Math.max(4, Math.min(100, Math.round(v)));
}

// ---- main view ----

export function SourcesView() {
  const feed = useGDT((s) => s.feed);
  const {
    data: connData,
    loading: connLoading,
    error: connError,
    refresh: refreshConn,
  } = useAsync(() => fetchConnectors(), []);
  const {
    data: healthData,
    loading: healthLoading,
    error: healthError,
    refresh: refreshHealth,
  } = useAsync(() => fetchHealth(), []);

  const sources: ConnectorInfo[] = connData?.sources ?? [];
  const recentEvents = healthData?.recentEvents ?? [];

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const sourceNameById = useMemo(() => {
    const m: Record<string, string> = {};
    sources.forEach((s) => (m[s.sourceId] = s.name));
    return m;
  }, [sources]);

  const totalSources = sources.length;
  const healthyCount = sources.filter((s) => s.status === "healthy").length;
  const liveCount = sources.filter((s) => s.live).length;
  const totalRecords = sources.reduce((sum, s) => sum + (s.recordCount ?? 0), 0);
  const syncingCount = sources.filter((s) => s.status === "syncing").length;

  const statusCounts = useMemo(() => {
    const order = ["healthy", "syncing", "degraded", "offline", "pending"];
    return order
      .map((status) => ({ status, count: sources.filter((s) => s.status === status).length }))
      .filter((x) => x.count > 0);
  }, [sources]);

  const refreshAll = () => {
    refreshConn();
    refreshHealth();
  };

  const onSyncOne = async (sourceId: string) => {
    setSyncingId(sourceId);
    try {
      await triggerSync(sourceId);
      refreshConn();
      refreshHealth();
    } finally {
      setSyncingId(null);
    }
  };

  const onSyncAll = async () => {
    setSyncingAll(true);
    try {
      await triggerSyncAll();
      refreshConn();
      refreshHealth();
    } finally {
      setSyncingAll(false);
    }
  };

  // event level → color / icon
  const eventMeta = (level: string) => {
    if (level === "error") return { color: "#f43f5e", Icon: XCircle };
    if (level === "warn") return { color: "#fbbf24", Icon: AlertTriangle };
    return { color: "#34d399", Icon: CheckCircle2 };
  };

  return (
    <div className="flex h-full w-full">
      {/* ===== LEFT COLUMN ===== */}
      <div className="gdt-scroll flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Header strip + KPIs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Database className="size-4 text-emerald-400" />
                  Data Ingestion Pipeline
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live connectors feeding the Ghana Digital Twin ·{" "}
                  <span className="font-mono tnum">{totalSources}</span> sources ·{" "}
                  <span className="font-mono tnum">{fmtRecords(totalRecords)}</span> records
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onSyncAll}
                  disabled={syncingAll || liveCount === 0}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 h-8 text-xs text-foreground/90 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncingAll ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  Sync all
                </button>
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400 gdt-blink" />
                  <span className="font-mono tnum text-[10px]">LIVE</span>
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricStat
                label="Total Sources"
                value={connLoading ? "…" : <span className="font-mono tnum">{totalSources}</span>}
                sub={`${totalSources - healthyCount} non-healthy`}
                accent="#34d399"
              />
              <MetricStat
                label="Healthy"
                value={connLoading ? "…" : <span className="font-mono tnum">{healthyCount}</span>}
                sub={totalSources ? `${Math.round((healthyCount / totalSources) * 100)}% availability` : "—"}
                accent="#34d399"
              />
              <MetricStat
                label="Live Connectors"
                value={connLoading ? "…" : <span className="font-mono tnum">{liveCount}</span>}
                sub={`${totalSources - liveCount} metadata-only`}
                accent="#2dd4bf"
              />
              <MetricStat
                label="Total Records"
                value={connLoading ? "…" : <span className="font-mono tnum">{fmtRecords(totalRecords)}</span>}
                sub="across all sources"
                accent="#fbbf24"
              />
            </div>
          </div>

          {/* Connectors grid */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Connectors</SectionLabel>
              <span className="text-[10px] text-muted-foreground font-mono tnum">
                {sources.length} active
              </span>
            </div>
            {connLoading && (
              <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-xs">Loading connectors…</span>
              </div>
            )}
            {connError && !connLoading && (
              <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
                <AlertTriangle className="size-5 text-rose-400" />
                <span className="text-xs">Failed to load connectors: {connError}</span>
              </div>
            )}
            {!connLoading && !connError && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sources.map((src) => (
                  <ConnectorCard
                    key={src.sourceId}
                    src={src}
                    syncing={syncingId === src.sourceId}
                    onSync={() => onSyncOne(src.sourceId)}
                  />
                ))}
                {sources.length === 0 && (
                  <div className="col-span-full text-center text-xs text-muted-foreground py-8">
                    No connectors registered.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== RIGHT COLUMN ===== */}
      <div className="gdt-scroll w-[340px] shrink-0 border-l border-border overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Pipeline Health */}
          <Panel
            title="Pipeline Health"
            icon={<Activity className="size-3.5 text-emerald-400" />}
          >
            {healthLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-end justify-between gap-2 h-24 mt-2">
                {statusCounts.length === 0 && (
                  <div className="flex-1 text-center text-[10px] text-muted-foreground italic self-center">
                    No sources
                  </div>
                )}
                {statusCounts.map(({ status, count }) => {
                  const color = statusColor(status);
                  const h = totalSources ? Math.max(6, (count / totalSources) * 100) : 0;
                  return (
                    <div key={status} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="text-[10px] font-mono tnum" style={{ color }}>
                        {count}
                      </div>
                      <div className="w-full flex items-end h-14">
                        <div
                          className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${h}%`,
                            background: color,
                            boxShadow: `0 0 8px ${color}55`,
                          }}
                        />
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {statusLabel(status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Ingest throughput</span>
                <span className="text-[11px] font-mono tnum text-foreground">
                  {recentEvents.length} ev / 24h
                </span>
              </div>
              <Sparkline
                data={[12, 18, 14, 22, 19, 26, 24, 31, 28, 34, 30, recentEvents.length || 38]}
                color="#34d399"
                width={96}
                height={22}
              />
            </div>
          </Panel>

          {/* Ingestion Log */}
          <Panel
            title="Ingestion Log"
            icon={<RefreshCw className="size-3.5 text-teal-400" />}
            right={
              <button
                onClick={refreshHealth}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors font-mono tnum"
                title="Refresh"
              >
                {recentEvents.length} events
              </button>
            }
          >
            <div className="relative mt-2 pl-4 max-h-72 overflow-y-auto gdt-scroll pr-1">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
              {healthLoading && (
                <div className="flex items-center gap-2 py-4 text-[10px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> loading…
                </div>
              )}
              {healthError && !healthLoading && (
                <div className="text-[10px] text-rose-400 py-2">Failed to load: {healthError}</div>
              )}
              {!healthLoading && !healthError && recentEvents.length === 0 && (
                <div className="text-[10px] text-muted-foreground italic py-2">
                  No recent ingestion events. Run a sync to populate.
                </div>
              )}
              <div className="flex flex-col gap-2.5">
                {recentEvents.map((ev: { id?: string; type: string; sourceId?: string | null; message: string; level: string; createdAt: string }) => {
                  const { color, Icon } = eventMeta(ev.level);
                  const sourceName = ev.sourceId ? sourceNameById[ev.sourceId] ?? ev.sourceId : null;
                  return (
                    <div
                      key={ev.id ?? `${ev.type}-${ev.createdAt}`}
                      className="relative group rounded-md hover:bg-foreground/5 px-1.5 py-1 -mx-1.5 transition-colors"
                    >
                      <span
                        className="absolute -left-[14px] top-2 size-2.5 rounded-full border-2 border-background"
                        style={{ background: color }}
                      />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {sourceName ?? ev.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono tnum shrink-0">
                          {timeAgo(ev.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Icon className="size-3 shrink-0" style={{ color }} />
                        <span className="text-[10px] text-muted-foreground font-mono">{ev.type}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
                        {ev.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* System Vitals */}
          <Panel title="System Vitals" icon={<Cpu className="size-3.5 text-orange-400" />}>
            <div className="flex flex-col gap-1 mt-2">
              <VitalRow
                icon={<Zap className="size-3.5 text-emerald-400" />}
                label="Sync queue depth"
                value={
                  syncingCount > 0 ? `${syncingCount} running` : "idle"
                }
              />
              <VitalRow
                icon={<HardDrive className="size-3.5 text-amber-400" />}
                label="Total records"
                value={fmtRecords(totalRecords)}
                spark={[8.2, 9.1, 10.4, 12.0, 14.8, 18.2, 22.1, 26.4, 31.0, 34.2]}
                sparkColor="#fbbf24"
              />
              <VitalRow
                icon={<Activity className="size-3.5 text-teal-400" />}
                label="API latency p95"
                value="42 ms"
              />
              <VitalRow
                icon={<Server className="size-3.5 text-emerald-400" />}
                label="Registered connectors"
                value={`${connData?.registeredConnectors.length ?? 0}`}
              />
              <VitalRow
                icon={<Layers className="size-3.5 text-amber-400" />}
                label="Total entities"
                value={healthData ? fmtRecords(healthData.summary.totalEntities) : "—"}
              />
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Live feed
                </span>
                <span className="text-[10px] text-muted-foreground font-mono tnum">
                  {feed.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto gdt-scroll pr-1">
                {feed.length === 0 && (
                  <span className="text-[10px] text-muted-foreground/60 italic">
                    No recent events
                  </span>
                )}
                {feed.map((f) => {
                  const color =
                    f.level === "crit"
                      ? "#f43f5e"
                      : f.level === "warn"
                        ? "#fbbf24"
                        : "#34d399";
                  return (
                    <div key={f.id} className="flex items-start gap-1.5 text-[10px]">
                      <span
                        className="size-1.5 rounded-full mt-1 shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-muted-foreground truncate">{f.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ---- sub-components ----

function ConnectorCard({
  src,
  syncing,
  onSync,
}: {
  src: ConnectorInfo;
  syncing: boolean;
  onSync: () => void;
}) {
  const pushFeed = useGDT((s) => s.pushFeed);
  const color = statusColor(src.status);
  const isSyncing = syncing || src.status === "syncing";
  const fill = freshnessFromLastSync(src.lastSyncAt);
  const tintBorder =
    src.status === "degraded" || src.status === "offline" ? `${color}66` : undefined;

  const StatusIcon =
    src.status === "healthy"
      ? CheckCircle2
      : src.status === "syncing"
        ? RefreshCw
        : src.status === "degraded"
          ? AlertTriangle
          : src.status === "offline"
            ? XCircle
            : Loader2;

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing) return;
    pushFeed({
      kind: "ingest",
      text: `${src.name} sync triggered`,
      detail: `${src.provider} · ${src.cadence}`,
      level: "info",
    });
    onSync();
  };

  return (
    <Card
      className="group bg-card/40 border-border py-0 transition-colors hover:border-primary/40"
      style={tintBorder ? { borderColor: tintBorder } : undefined}
    >
      <CardContent className="p-3 flex flex-col gap-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative inline-flex size-2 mt-0.5">
              {isSyncing && (
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-60 gdt-blink"
                  style={{ background: color }}
                />
              )}
              <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate">{src.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{src.provider}</div>
            </div>
          </div>
          <StatusIcon
            className={`size-3.5 shrink-0 ${isSyncing ? "animate-spin" : ""}`}
            style={{ color }}
          />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
            {src.category}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono tnum">
            {src.resolution}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-mono tnum gap-1"
            style={{
              color: src.live ? "#34d399" : "#a1a1aa",
              borderColor: src.live ? "#34d39944" : "#a1a1aa44",
            }}
          >
            {src.live ? (
              <Radio className="size-2.5" />
            ) : (
              <FileBox className="size-2.5" />
            )}
            {src.live ? "Live" : "Metadata"}
          </Badge>
        </div>

        {/* Sync info */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="size-2.5" />
            <span className="font-mono tnum">
              {src.lastSyncAt ? timeAgo(src.lastSyncAt) : "never"}
            </span>
          </span>
          <span className="text-muted-foreground/80 font-mono tnum">{src.cadence}</span>
        </div>

        {/* Freshness progress (live sources only) */}
        {src.live ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Freshness</span>
              <span className="font-mono tnum" style={{ color }}>
                {fill}%
              </span>
            </div>
            <Progress
              value={fill}
              className="h-1.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-[var(--freshness-color)]"
              style={
                {
                  "--freshness-color": color,
                } as React.CSSProperties
              }
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-foreground/[0.02] px-2 py-1.5 text-[10px] text-muted-foreground italic leading-snug">
            metadata only — bulk ingest required
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Records</span>
            <span className="text-[11px] font-mono tnum text-foreground">
              {fmtRecords(src.recordCount)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Storage</span>
            <span className="text-[11px] font-mono tnum text-foreground capitalize">
              {src.storageType}
            </span>
          </div>
        </div>

        {/* Coverage + license */}
        <div className="text-[10px] text-muted-foreground/80 leading-snug">
          {src.coverage} · {src.license}
        </div>

        {/* Sync button (live only) */}
        {src.live && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-7 text-[11px] text-foreground/90 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="size-3" /> Sync now
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {title}
          </span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function VitalRow({
  icon,
  label,
  value,
  spark,
  sparkColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md hover:bg-foreground/5 px-1.5 py-1 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {spark && sparkColor && <Sparkline data={spark} color={sparkColor} width={50} height={16} />}
        <span className="text-[11px] font-mono tnum text-foreground">{value}</span>
      </div>
    </div>
  );
}
