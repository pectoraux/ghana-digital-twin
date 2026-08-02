"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Activity,
  Satellite,
  RefreshCw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Radio,
  CloudRain,
  Map,
  Users,
  Database,
  ArrowRight,
} from "lucide-react";

const FRESHNESS_META: Record<string, { color: string; label: string; icon: string }> = {
  fresh: { color: "#34d399", label: "Fresh", icon: "🟢" },
  recent: { color: "#fbbf24", label: "Recent", icon: "🟡" },
  stale: { color: "#fb923c", label: "Stale", icon: "🟠" },
  expired: { color: "#f43f5e", label: "Expired", icon: "🔴" },
  unknown: { color: "#71717a", label: "Unknown", icon: "⚪" },
};

const SOURCE_TYPE_ICON: Record<string, React.ElementType> = {
  satellite: Satellite,
  weather: CloudRain,
  osm: Map,
  community: Users,
  sensor: Radio,
};

type Tab = "overview" | "freshness" | "connectors" | "runs" | "alerts";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Health Dashboard", icon: Activity },
  { id: "freshness", label: "Freshness Monitor", icon: RefreshCw },
  { id: "connectors", label: "Connectors", icon: Database },
  { id: "runs", label: "Ingestion Runs", icon: Clock },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function RealityFeedView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Activity className="size-4 text-primary" /> Intelligence Reality Feed
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[14px] font-mono text-primary">
            package: reality-feed
          </span>
          <p className="text-[15px] text-muted-foreground hidden lg:block">
            Continuous ingestion of reality · Freshness monitoring · Automatic observation triggers
          </p>
        </div>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                  active ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent")}>
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab />}
        {tab === "freshness" && <FreshnessTab />}
        {tab === "connectors" && <ConnectorsTab />}
        {tab === "runs" && <RunsTab />}
        {tab === "alerts" && <AlertsTab />}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: HEALTH DASHBOARD (Overview)
// ===========================================================================

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const load = useCallback(() => {
    api("/api/reality-feed").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await api("/api/reality-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ingest" }) });
      load();
    } finally { setIngesting(false); }
  };

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      {/* Reality feed health */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Active Connectors" value={o.health.activeConnectors} sub={`${o.counts.connectors} total`} accent="#34d399" />
        <MetricStat label="Fresh Sources" value={o.health.freshSources} sub={`${o.health.healthySources} healthy`} accent="#34d399" />
        <MetricStat label="Stale Sources" value={o.health.staleSources} sub="need attention" accent={o.health.staleSources > 0 ? "#fb923c" : "#34d399"} />
        <MetricStat label="Active Alerts" value={o.counts.alerts} sub="freshness alerts" accent={o.counts.alerts > 0 ? "#f43f5e" : "#34d399"} />
        <MetricStat label="Ingestion Runs" value={o.counts.runs} sub="total" accent="#22d3ee" />
        <MetricStat label="Capabilities" value={o.counts.freshness} sub="monitored" accent="#a78bfa" />
      </div>

      {/* Latest data timestamps — the heartbeat */}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <SectionLabel className="mb-2 flex items-center gap-1.5"><Activity className="size-3" /> Reality Feed Heartbeat — Latest Data</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {o.latestData.latestScene && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Satellite className="size-4 text-emerald-400" />
                <span className="text-[15px] font-semibold text-emerald-300">Sentinel-2 Satellite</span>
                <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[13px] font-semibold",
                  o.latestData.latestScene.hoursAgo < 120 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>
                  {o.latestData.latestScene.hoursAgo < 120 ? "🟢 LIVE" : "🟡 RECENT"}
                </span>
              </div>
              <div className="text-[14px] text-muted-foreground mb-0.5">Latest scene: {o.latestData.latestScene.stacId}</div>
              <div className="text-[14px] text-muted-foreground mb-0.5">Tile: {o.latestData.latestScene.mgrsTile}</div>
              <div className="text-[18px] font-mono font-semibold text-emerald-300">
                {o.latestData.latestScene.hoursAgo < 24 ? `${o.latestData.latestScene.hoursAgo.toFixed(1)}h ago` : `${(o.latestData.latestScene.hoursAgo / 24).toFixed(1)}d ago`}
              </div>
              <div className="text-[13px] text-muted-foreground">{new Date(o.latestData.latestScene.datetime).toUTCString()}</div>
            </div>
          )}
          {o.latestData.latestObservation && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="size-4 text-cyan-400" />
                <span className="text-[15px] font-semibold text-cyan-300">Latest Observation</span>
                <span className="ml-auto rounded bg-cyan-500/15 px-1.5 py-0.5 text-[13px] font-semibold text-cyan-300">🟢 ACTIVE</span>
              </div>
              <div className="text-[14px] text-muted-foreground mb-0.5">Type: {o.latestData.latestObservation.type}</div>
              <div className="text-[14px] text-muted-foreground mb-0.5 truncate">UUID: {o.latestData.latestObservation.uuid}</div>
              <div className="text-[18px] font-mono font-semibold text-cyan-300">
                {o.latestData.latestObservation.hoursAgo < 1 ? `${(o.latestData.latestObservation.hoursAgo * 60).toFixed(0)}m ago` : `${o.latestData.latestObservation.hoursAgo.toFixed(1)}h ago`}
              </div>
            </div>
          )}
          {o.latestData.latestCommunityEvent && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="size-4 text-violet-400" />
                <span className="text-[15px] font-semibold text-violet-300">Community Intelligence</span>
                <span className="ml-auto rounded bg-violet-500/15 px-1.5 py-0.5 text-[13px] font-semibold text-violet-300">🟢 LIVE</span>
              </div>
              <div className="text-[14px] text-muted-foreground mb-0.5 truncate">{o.latestData.latestCommunityEvent.title}</div>
              <div className="text-[14px] text-muted-foreground mb-0.5">Event: {o.latestData.latestCommunityEvent.eventId}</div>
              <div className="text-[18px] font-mono font-semibold text-violet-300">
                {o.latestData.latestCommunityEvent.hoursAgo < 1 ? `${(o.latestData.latestCommunityEvent.hoursAgo * 60).toFixed(0)}m ago` : `${o.latestData.latestCommunityEvent.hoursAgo.toFixed(1)}h ago`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connector health summary */}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <SectionLabel className="mb-2">Connector Health Summary</SectionLabel>
        <div className="space-y-1">
          {o.connectors.map((c: any) => {
            const Icon = SOURCE_TYPE_ICON[c.sourceType] ?? Database;
            const fmeta = FRESHNESS_META[c.freshnessStatus] ?? FRESHNESS_META.unknown;
            return (
              <div key={c.connectorId} className="flex items-center gap-2 text-[15px] py-1 border-b border-border/30 last:border-0">
                <Icon className="size-3 shrink-0" style={{ color: fmeta.color }} />
                <span className="font-medium flex-1 truncate">{c.name}</span>
                <span className="text-[13px] text-muted-foreground">{c.cadenceLabel}</span>
                {c.freshnessHoursAgo !== null && c.freshnessHoursAgo !== undefined && (
                  <span className="text-[13px] text-muted-foreground">
                    {c.freshnessHoursAgo < 24 ? `${c.freshnessHoursAgo.toFixed(0)}h ago` : `${(c.freshnessHoursAgo / 24).toFixed(1)}d ago`}
                  </span>
                )}
                <span className="rounded px-1.5 py-0.5 text-[13px] font-semibold" style={{ color: fmeta.color, background: `${fmeta.color}1a` }}>
                  {fmeta.icon} {fmeta.label}
                </span>
                <span className={cn("rounded px-1 py-0.5 text-[13px]",
                  c.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{c.status}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual ingestion trigger */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="size-4 text-primary" />
          <span className="text-[15px] font-semibold text-primary">MANUAL REALITY INGESTION</span>
        </div>
        <p className="text-[15px] text-foreground/80 leading-relaxed mb-3">
          Trigger a fresh Sentinel-2 STAC ingestion from the Element 84 Earth Search API. Fetches recent scenes,
          stores COG band URLs, and automatically triggers observation generation on new data. This is the
          "perceive reality" button — the heartbeat of the intelligence OS.
        </p>
        <button onClick={handleIngest} disabled={ingesting}
          className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50">
          {ingesting ? <Loader2 className="size-3.5 animate-spin" /> : <Satellite className="size-3.5" />}
          {ingesting ? "Ingesting..." : "Trigger Sentinel-2 Ingestion"}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: FRESHNESS MONITOR
// ===========================================================================

function FreshnessTab() {
  const [freshness, setFreshness] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api("/api/reality-feed/freshness").then((d) => setFreshness(d.freshness)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api("/api/reality-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refreshFreshness" }) });
      load();
    } finally { setRefreshing(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <RefreshCw className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Freshness Monitor</span>
        <span className="text-[15px] text-muted-foreground">— per-capability freshness status</span>
        <button onClick={handleRefresh} disabled={refreshing}
          className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-1 text-[14px] text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RefreshCw className={cn("size-3", refreshing && "animate-spin")} /> Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {freshness.map((f) => {
          const fmeta = FRESHNESS_META[f.freshnessStatus] ?? FRESHNESS_META.unknown;
          const Icon = SOURCE_TYPE_ICON[f.sourceType] ?? Database;
          return (
            <div key={f.capabilityId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5 flex items-center gap-3">
              <div className={cn("size-9 rounded-md flex items-center justify-center shrink-0")} style={{ color: fmeta.color, background: `${fmeta.color}1a` }}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-medium truncate">{f.capabilityLabel}</div>
                <div className="text-[13px] text-muted-foreground font-mono">{f.capabilityId}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[18px] font-bold" style={{ color: fmeta.color }}>
                  {f.freshnessHoursAgo !== null ? (f.freshnessHoursAgo < 24 ? `${f.freshnessHoursAgo.toFixed(0)}h` : `${(f.freshnessHoursAgo / 24).toFixed(1)}d`) : "—"}
                </div>
                <div className="text-[13px] text-muted-foreground">ago</div>
              </div>
              <div className="text-right shrink-0">
                <span className="rounded px-1.5 py-0.5 text-[14px] font-semibold" style={{ color: fmeta.color, background: `${fmeta.color}1a` }}>
                  {fmeta.icon} {fmeta.label}
                </span>
                <div className={cn("text-[13px] mt-0.5",
                  f.healthStatus === "healthy" ? "text-emerald-400" : f.healthStatus === "degraded" ? "text-amber-400" : "text-rose-400")}>
                  {f.healthStatus}
                </div>
              </div>
            </div>
          );
        })}
        {freshness.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="size-8 opacity-30" />
            <span className="text-xs">No freshness data — click Refresh</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: CONNECTORS
// ===========================================================================

function ConnectorsTab() {
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/reality-feed/connectors").then((d) => setConnectors(d.connectors)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Database className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Data Source Connectors</span>
        <span className="text-[15px] text-muted-foreground">— registered ingestion pipelines with schedules</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{connectors.length} connectors</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {connectors.map((c) => {
          const fmeta = FRESHNESS_META[c.freshnessStatus] ?? FRESHNESS_META.unknown;
          const Icon = SOURCE_TYPE_ICON[c.sourceType] ?? Database;
          return (
            <div key={c.connectorId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-stretch gap-3">
                <div className="w-1 shrink-0 rounded-full" style={{ background: fmeta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Icon className="size-3.5" style={{ color: fmeta.color }} />
                    <span className="font-mono text-[14px] font-semibold text-muted-foreground">{c.connectorId}</span>
                    <span className={cn("rounded px-1 py-0.5 text-[13px]",
                      c.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{c.status}</span>
                    <span className="rounded bg-foreground/5 px-1 py-0.5 text-[13px] capitalize">{c.sourceType}</span>
                    <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color: fmeta.color, background: `${fmeta.color}1a` }}>
                      {fmeta.icon} {fmeta.label}
                    </span>
                    {c.autoTriggerObservations && <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[13px] text-violet-300">⚡ auto-trigger</span>}
                  </div>
                  <div className="text-[16px] font-medium mb-0.5">{c.name}</div>
                  <p className="text-[15px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{c.description}</p>
                  <div className="flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap">
                    <span>provider: {c.provider}</span>
                    <span className="flex items-center gap-1"><Clock className="size-2.5" /> {c.cadenceLabel}</span>
                    <span>runs: {c.totalRuns} ({c.totalSuccess}✓ {c.totalFailed}✗)</span>
                    <span>records: {c.totalRecordsIngested}</span>
                    {c.freshnessHoursAgo !== null && c.freshnessHoursAgo !== undefined && (
                      <span>latest data: {c.freshnessHoursAgo < 24 ? `${c.freshnessHoursAgo.toFixed(0)}h ago` : `${(c.freshnessHoursAgo / 24).toFixed(1)}d ago`}</span>
                    )}
                    {c.lastRunAt && <span>last run: {timeAgo(c.lastRunAt)}</span>}
                  </div>
                  {c.lastError && <div className="text-[14px] text-rose-400 mt-1">⚠ {c.lastError}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: INGESTION RUNS
// ===========================================================================

function RunsTab() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/reality-feed/runs").then((d) => setRuns(d.runs)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Clock className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Ingestion Runs</span>
        <span className="text-[15px] text-muted-foreground">— execution audit trail</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{runs.length} runs</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {runs.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Clock className="size-8 opacity-30" />
            <span className="text-xs">No ingestion runs yet. Trigger one from the Health Dashboard.</span>
          </div>
        )}
        {runs.map((r) => {
          const color = r.status === "success" ? "#34d399" : r.status === "failed" ? "#f43f5e" : r.status === "running" ? "#fbbf24" : "#a1a1aa";
          return (
            <div key={r.runId} className="rounded-lg border border-border bg-card/40 px-3 py-2 flex items-center gap-3">
              <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0")} style={{ color, background: `${color}1a` }}>
                {r.status === "success" ? <CheckCircle2 className="size-4" /> : r.status === "failed" ? <XCircle className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-semibold text-muted-foreground">{r.runId}</span>
                  <span className="text-[14px] text-muted-foreground">connector: {r.connectorId}</span>
                  <span className="text-[14px] text-muted-foreground">by: {r.triggeredBy}</span>
                </div>
                <div className="flex items-center gap-3 text-[14px] text-muted-foreground mt-0.5">
                  <span className="rounded px-1 py-0.5 text-[13px] font-semibold" style={{ color, background: `${color}1a` }}>{r.status}</span>
                  <span>found: {r.recordsFound}</span>
                  <span>ingested: {r.recordsIngested}</span>
                  {r.observationsTriggered > 0 && <span className="text-violet-400">observations: {r.observationsTriggered}</span>}
                  {r.durationMs && <span>duration: {(r.durationMs / 1000).toFixed(1)}s</span>}
                  <span className="ml-auto">{timeAgo(r.startedAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: ALERTS
// ===========================================================================

function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api("/api/reality-feed/alerts").then((d) => setAlerts(d.alerts)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (alertId: string) => {
    await api("/api/reality-feed/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", alertId }) });
    load();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <AlertTriangle className="size-4 text-rose-400" />
        <span className="text-xs font-semibold">Freshness Alerts</span>
        <span className="text-[15px] text-muted-foreground">— stale data + connector failures</span>
        <span className="ml-auto text-[14px] text-muted-foreground">{alerts.length} alerts</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {alerts.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-8 text-emerald-400 opacity-50" />
            <span className="text-xs">No active alerts — all data sources healthy</span>
          </div>
        )}
        {alerts.map((a) => {
          const color = a.severity === "critical" ? "#f43f5e" : a.severity === "warn" ? "#fb923c" : "#38bdf8";
          return (
            <div key={a.alertId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[14px] font-semibold text-muted-foreground">{a.alertId}</span>
                <span className="rounded px-1 py-0.5 text-[13px] font-semibold uppercase" style={{ color, background: `${color}1a` }}>{a.severity}</span>
                <span className="rounded bg-foreground/5 px-1 py-0.5 text-[13px] font-mono">{a.alertType}</span>
                {a.connectorId && <span className="text-[13px] text-muted-foreground">connector: {a.connectorId}</span>}
                <span className="ml-auto text-[13px] text-muted-foreground">{timeAgo(a.triggeredAt)}</span>
              </div>
              <div className="text-[16px] font-medium mb-0.5">{a.title}</div>
              <div className="text-[15px] text-foreground/70">{a.description}</div>
              {a.status === "active" && (
                <button onClick={() => handleResolve(a.alertId)}
                  className="mt-1.5 flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[14px] text-emerald-400 hover:bg-emerald-500/10">
                  <CheckCircle2 className="size-3" /> Resolve
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
