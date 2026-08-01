"use client";

import * as React from "react";
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
} from "lucide-react";
import { DATA_SOURCES, INGESTION_LOG } from "@/lib/gdt/sources";
import { SOURCE_STATUS_META } from "@/lib/gdt/format";
import { useGDT } from "@/lib/gdt/store";
import {
  MetricStat,
  StatusDot,
  SectionLabel,
  Sparkline,
} from "@/components/gdt/atoms";
import type { DataSource, SourceStatus } from "@/lib/gdt/types";

// ---- inline time / formatting helpers (no extra imports) ----

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function fmtRecords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

// Lower freshnessMin = better. Map to 0..100 (fresh=100).
// Log scale so static (1y) sources still render a small bar.
function freshnessFill(min: number): number {
  const v = 100 - Math.log10(Math.max(1, min)) * 30;
  return Math.max(4, Math.min(100, Math.round(v)));
}

function statusFill(status: SourceStatus): string {
  return SOURCE_STATUS_META[status].color;
}

// ---- main view ----

export function SourcesView() {
  const feed = useGDT((s) => s.feed);

  const totalSources = DATA_SOURCES.length;
  const healthyCount = DATA_SOURCES.filter(
    (s) => s.status === "healthy"
  ).length;
  const totalStorage = DATA_SOURCES.reduce((sum, s) => sum + s.storageTB, 0);
  // cap per-source freshness at 24h so static layers don't skew the average
  const avgFreshness = Math.round(
    DATA_SOURCES.reduce((sum, s) => sum + Math.min(s.freshnessMin, 1440), 0) /
      DATA_SOURCES.length
  );

  const statusCounts: { status: SourceStatus; count: number }[] = (
    ["healthy", "syncing", "degraded", "offline"] as SourceStatus[]
  ).map((status) => ({
    status,
    count: DATA_SOURCES.filter((s) => s.status === status).length,
  }));

  const storageGrowth = [8.2, 9.1, 10.4, 12.0, 14.8, 18.2, 22.1, 26.4, 31.0, 34.2];
  const ingestRateSeries = [
    120, 180, 142, 220, 198, 260, 240, 310, 285, 340, 320, 412,
  ];

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
                  <span className="font-mono tnum">
                    {totalStorage.toFixed(1)} TB
                  </span>{" "}
                  archived
                </p>
              </div>
              <Badge
                variant="outline"
                className="gap-1.5 shrink-0"
              >
                <span className="size-1.5 rounded-full bg-emerald-400 gdt-blink" />
                <span className="font-mono tnum text-[10px]">LIVE</span>
              </Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricStat
                label="Total Sources"
                value={
                  <span className="font-mono tnum">{totalSources}</span>
                }
                sub={`${totalSources - healthyCount} non-healthy`}
                accent="#34d399"
              />
              <MetricStat
                label="Healthy"
                value={
                  <span className="font-mono tnum">{healthyCount}</span>
                }
                sub={`${Math.round((healthyCount / totalSources) * 100)}% availability`}
                accent="#34d399"
              />
              <MetricStat
                label="Total Storage"
                value={
                  <span className="font-mono tnum">
                    {totalStorage.toFixed(1)} TB
                  </span>
                }
                sub="across all connectors"
                accent="#fbbf24"
              />
              <MetricStat
                label="Avg Freshness"
                value={
                  <span className="font-mono tnum">{avgFreshness}m</span>
                }
                sub="capped at 24h"
                accent="#2dd4bf"
              />
            </div>
          </div>

          {/* Connectors grid */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Connectors</SectionLabel>
              <span className="text-[10px] text-muted-foreground font-mono tnum">
                {DATA_SOURCES.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {DATA_SOURCES.map((src) => (
                <ConnectorCard key={src.id} src={src} />
              ))}
            </div>
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
            <div className="flex items-end justify-between gap-2 h-24 mt-2">
              {statusCounts.map(({ status, count }) => {
                const meta = SOURCE_STATUS_META[status];
                const h = Math.max(6, (count / totalSources) * 100);
                return (
                  <div
                    key={status}
                    className="flex-1 flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="text-[10px] font-mono tnum"
                      style={{ color: meta.color }}
                    >
                      {count}
                    </div>
                    <div className="w-full flex items-end h-14">
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          height: `${h}%`,
                          background: meta.color,
                          boxShadow: `0 0 8px ${meta.color}55`,
                        }}
                      />
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">
                  Ingest throughput
                </span>
                <span className="text-[11px] font-mono tnum text-foreground">
                  412 ev/hr
                </span>
              </div>
              <Sparkline
                data={ingestRateSeries}
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
              <span className="text-[10px] text-muted-foreground font-mono tnum">
                {INGESTION_LOG.length} events
              </span>
            }
          >
            <div className="relative mt-2 pl-4 max-h-72 overflow-y-auto gdt-scroll pr-1">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
              <div className="flex flex-col gap-2.5">
                {INGESTION_LOG.map((ev) => {
                  const color =
                    ev.status === "ok"
                      ? "#34d399"
                      : ev.status === "warn"
                        ? "#fbbf24"
                        : "#f43f5e";
                  const Icon =
                    ev.status === "ok"
                      ? CheckCircle2
                      : ev.status === "warn"
                        ? AlertTriangle
                        : XCircle;
                  return (
                    <div
                      key={ev.id}
                      className="relative group rounded-md hover:bg-foreground/5 px-1.5 py-1 -mx-1.5 transition-colors"
                    >
                      <span
                        className="absolute -left-[14px] top-2 size-2.5 rounded-full border-2 border-background"
                        style={{ background: color }}
                      />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {ev.source}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono tnum shrink-0">
                          {relTime(ev.time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Icon
                          className="size-3 shrink-0"
                          style={{ color }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {ev.action}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
                        {ev.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* System Vitals */}
          <Panel
            title="System Vitals"
            icon={<Cpu className="size-3.5 text-orange-400" />}
          >
            <div className="flex flex-col gap-1 mt-2">
              <VitalRow
                icon={<Zap className="size-3.5 text-emerald-400" />}
                label="Inference throughput"
                value="412 tiles/min"
              />
              <VitalRow
                icon={<HardDrive className="size-3.5 text-amber-400" />}
                label="Storage growth"
                value="+2.4 TB / 24h"
                spark={storageGrowth}
                sparkColor="#fbbf24"
              />
              <VitalRow
                icon={<Activity className="size-3.5 text-teal-400" />}
                label="API latency p95"
                value="42 ms"
              />
              <VitalRow
                icon={<Server className="size-3.5 text-emerald-400" />}
                label="Queue depth"
                value="3 jobs"
              />
              <VitalRow
                icon={<Layers className="size-3.5 text-amber-400" />}
                label="Tile cache hit"
                value="94.2%"
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
                    <div
                      key={f.id}
                      className="flex items-start gap-1.5 text-[10px]"
                    >
                      <span
                        className="size-1.5 rounded-full mt-1 shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-muted-foreground truncate">
                        {f.text}
                      </span>
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

function ConnectorCard({ src }: { src: DataSource }) {
  const pushFeed = useGDT((s) => s.pushFeed);
  const meta = SOURCE_STATUS_META[src.status];
  const fill = freshnessFill(src.freshnessMin);
  const fillColor = statusFill(src.status);
  // tint border for degraded / offline
  const tintBorder =
    src.status === "degraded" || src.status === "offline"
      ? `${meta.color}66`
      : undefined;

  const StatusIcon =
    src.status === "healthy"
      ? CheckCircle2
      : src.status === "syncing"
        ? RefreshCw
        : src.status === "degraded"
          ? AlertTriangle
          : XCircle;

  return (
    <Card
      onClick={() =>
        pushFeed({
          kind: "ingest",
          text: `${src.name} manual sync queued`,
          detail: `${src.provider} · ${src.cadence}`,
          level: "info",
        })
      }
      className="group cursor-pointer bg-card/40 border-border py-0 transition-colors hover:border-primary/40"
      style={tintBorder ? { borderColor: tintBorder } : undefined}
    >
      <CardContent className="p-3 flex flex-col gap-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot color={meta.color} pulse={src.status === "syncing"} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate">
                {src.name}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {src.provider}
              </div>
            </div>
          </div>
          <StatusIcon
            className={`size-3.5 shrink-0 ${src.status === "syncing" ? "animate-spin" : ""}`}
            style={{ color: meta.color }}
          />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 capitalize"
          >
            {src.category}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-mono tnum"
          >
            {src.resolution}
          </Badge>
        </div>

        {/* Sync info */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="size-2.5" />
            <span className="font-mono tnum">{relTime(src.lastSync)}</span>
          </span>
          <span className="text-muted-foreground/80 font-mono tnum">
            {src.cadence}
          </span>
        </div>

        {/* Freshness progress */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Freshness</span>
            <span className="font-mono tnum" style={{ color: fillColor }}>
              {fill}%
            </span>
          </div>
          <Progress
            value={fill}
            className="h-1.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-[var(--freshness-color)]"
            style={
              {
                "--freshness-color": fillColor,
              } as React.CSSProperties
            }
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between pt-1 border-t border-border/60">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Records
            </span>
            <span className="text-[11px] font-mono tnum text-foreground">
              {fmtRecords(src.records)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Storage
            </span>
            <span className="text-[11px] font-mono tnum text-foreground">
              {src.storageTB.toFixed(2)} TB
            </span>
          </div>
        </div>

        {/* Coverage + license */}
        <div className="text-[10px] text-muted-foreground/80 leading-snug">
          {src.coverage} · {src.license}
        </div>
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
        <span className="text-[11px] text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {spark && sparkColor && (
          <Sparkline data={spark} color={sparkColor} width={50} height={16} />
        )}
        <span className="text-[11px] font-mono tnum text-foreground">
          {value}
        </span>
      </div>
    </div>
  );
}
