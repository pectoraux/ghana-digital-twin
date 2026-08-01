"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Globe,
  Network,
  Users,
  Package,
  Megaphone,
  ScrollText,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  DollarSign,
  Zap,
  Server,
  FileKey,
  Handshake,
} from "lucide-react";

const NODE_TYPE_META: Record<string, { color: string; icon: string }> = {
  national: { color: "#34d399", icon: "🏴" },
  regional: { color: "#a78bfa", icon: "🌐" },
  organizational: { color: "#22d3ee", icon: "🏛" },
};

const TREATY_TYPE_META: Record<string, { color: string; label: string }> = {
  bilateral: { color: "#34d399", label: "Bilateral" },
  multilateral: { color: "#a78bfa", label: "Multilateral" },
  regional: { color: "#22d3ee", label: "Regional" },
};

const LICENSE_TYPE_META: Record<string, { color: string; label: string }> = {
  commercial_africa: { color: "#fbbf24", label: "Commercial Africa" },
  open_intelligence: { color: "#34d399", label: "Open Intelligence" },
  government_only: { color: "#f43f5e", label: "Government Only" },
};

type Tab = "overview" | "network" | "identity" | "assets" | "markets" | "treaties" | "sync";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Globe },
  { id: "network", label: "Network Map", icon: Network },
  { id: "identity", label: "Federated Identity", icon: FileKey },
  { id: "assets", label: "Asset Exchange", icon: Package },
  { id: "markets", label: "Cross-Border Markets", icon: Megaphone },
  { id: "treaties", label: "Treaties", icon: ScrollText },
  { id: "sync", label: "Sync Protocol", icon: RefreshCw },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export function FederationView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Globe className="size-4 text-primary" /> Federated Intelligence Network
          </h2>
          <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            package: federated-intelligence
          </span>
          <p className="text-[11px] text-muted-foreground hidden lg:block">
            Multiple intelligence civilizations interoperate without surrendering sovereignty
          </p>
          <PackageBadge />
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
        {tab === "network" && <NetworkTab />}
        {tab === "identity" && <IdentityTab />}
        {tab === "assets" && <AssetsTab />}
        {tab === "markets" && <MarketsTab />}
        {tab === "treaties" && <TreatiesTab />}
        {tab === "sync" && <SyncTab />}
      </div>
    </div>
  );
}

function PackageBadge() {
  const [packages, setPackages] = useState<any[]>([]);
  useEffect(() => { api("/api/federation").then((d) => setPackages(d.packages)).catch(() => {}); }, []);
  if (packages.length === 0) return null;
  return (
    <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
      <ShieldCheck className="size-3 text-emerald-400" />
      <span className="font-mono">v{packages[0].version}</span>
      <span>·</span>
      <span>{packages[0].provides.length} capabilities</span>
      <span>·</span>
      <span>{packages[0].subPackages.length} sub-packages</span>
    </div>
  );
}

// ===========================================================================
// TAB: OVERVIEW
// ===========================================================================

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation").then((d) => setData(d.overview)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  const o = data;

  return (
    <div className="h-full overflow-y-auto gdt-scroll p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricStat label="Federation Nodes" value={o.active.activeNodes} sub={`${o.counts.nodes} total`} accent="#34d399" />
        <MetricStat label="Trust Proofs" value={o.counts.proofs} sub="identity attestations" accent="#a78bfa" />
        <MetricStat label="Federated Assets" value={o.counts.listings} sub="cross-border listings" accent="#22d3ee" />
        <MetricStat label="Cross-Border Budget" value={`${(o.economy.totalCbBudget / 1000).toFixed(0)}K`} sub="IC" accent="#fbbf24" />
        <MetricStat label="Active Treaties" value={o.active.activeTreaties} sub="governance agreements" accent="#f43f5e" />
        <MetricStat label="Sync Runs" value={o.counts.syncRuns} sub="federation syncs" accent="#fb923c" />
      </div>

      {/* Nodes + top listings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Network className="size-3" /> Federation Nodes</SectionLabel>
          <div className="space-y-1">
            {o.nodes.map((n: any) => {
              const meta = NODE_TYPE_META[n.nodeType] ?? NODE_TYPE_META.national;
              return (
                <div key={n.nodeId} className="flex items-center gap-2 text-[11px] py-1">
                  <span className="size-2 rounded-full" style={{ background: meta.color }} />
                  <span className="font-medium flex-1 truncate">{n.name}</span>
                  <span className="text-muted-foreground">{n.countryCode}</span>
                  <span className="font-mono font-semibold" style={{ color: meta.color }}>{(n.trustScore * 100).toFixed(0)}%</span>
                  <span className="text-muted-foreground text-[9px]">{n.treatiesCount} treaties</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Package className="size-3" /> Top Federated Assets</SectionLabel>
          <div className="space-y-1">
            {o.topListings.map((l: any) => (
              <div key={l.listingId} className="flex items-center gap-2 text-[11px] py-1">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="flex-1 truncate">{l.assetTitle}</span>
                <span className="text-muted-foreground text-[9px]">{l.homeNodeId}</span>
                <span className="font-mono font-semibold text-emerald-400">{(l.iqs * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="size-4 text-primary" />
          <span className="text-[11px] font-semibold text-primary">FEDERATION PRINCIPLES</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-emerald-400 mb-0.5">Data Stays Local</div>
            <div className="text-[10px] text-muted-foreground">Each node owns its data, citizens, governance, trust graph. Only proofs + asset listings + capabilities are exchanged.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-violet-400 mb-0.5">Trust Never Copied</div>
            <div className="text-[10px] text-muted-foreground">Only proofs are exchanged. Receiving node sets imported trust (lower). Local evidence updates it over time.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-cyan-400 mb-0.5">Capability Negotiation</div>
            <div className="text-[10px] text-muted-foreground">"Who provides this capability?" not "give me your data." No code changes, no data migration.</div>
          </div>
          <div className="rounded border border-border bg-card/40 p-2.5">
            <div className="text-[10px] font-medium text-amber-400 mb-0.5">Treaty-Governed</div>
            <div className="text-[10px] text-muted-foreground">Bilateral/multilateral treaties define what can be shared and what's restricted. Governance as a package.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: NETWORK MAP
// ===========================================================================

function NetworkTab() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation/nodes").then((d) => setNodes(d.nodes)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  // Layout nodes in a circle with ECOWAS in center
  const center = { x: 250, y: 200 };
  const nationalNodes = nodes.filter((n) => n.nodeType === "national");
  const regionalNodes = nodes.filter((n) => n.nodeType === "regional");

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Network className="size-4 text-emerald-400" />
        <span className="text-xs font-semibold">Federation Network Map</span>
        <span className="text-[11px] text-muted-foreground">— {nodes.length} participating intelligence networks</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto gdt-scroll p-4">
        <svg viewBox="0 0 500 400" className="w-full" style={{ maxHeight: "50vh" }}>
          {/* Connection lines from regional center to national nodes */}
          {regionalNodes.map((rn) => nationalNodes.map((nn, i) => {
            const angle = (i / nationalNodes.length) * Math.PI * 2 - Math.PI / 2;
            const x = center.x + Math.cos(angle) * 120;
            const y = center.y + Math.sin(angle) * 120;
            return <line key={`${rn.nodeId}-${nn.nodeId}`} x1={center.x} y1={center.y} x2={x} y2={y}
              stroke="#71717a" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3,3" />;
          }))}
          {/* National nodes */}
          {nationalNodes.map((n, i) => {
            const angle = (i / nationalNodes.length) * Math.PI * 2 - Math.PI / 2;
            const x = center.x + Math.cos(angle) * 120;
            const y = center.y + Math.sin(angle) * 120;
            const meta = NODE_TYPE_META[n.nodeType] ?? NODE_TYPE_META.national;
            const r = 12 + n.trustScore * 10;
            return (
              <g key={n.nodeId}>
                <circle cx={x} cy={y} r={r} fill={meta.color} fillOpacity={0.2} stroke={meta.color} strokeWidth={2} />
                <text x={x} y={y + r + 12} fontSize="9" fill="#e4e4e7" textAnchor="middle" className="font-medium">{n.countryCode}</text>
                <text x={x} y={y + r + 22} fontSize="7" fill="#71717a" textAnchor="middle">{n.name.split(" ")[0]}</text>
                <title>{n.name} — trust {(n.trustScore * 100).toFixed(0)}%, {n.treatiesCount} treaties, {n.assetsShared} shared</title>
              </g>
            );
          })}
          {/* Regional node (ECOWAS) in center */}
          {regionalNodes.map((n) => {
            const meta = NODE_TYPE_META[n.nodeType] ?? NODE_TYPE_META.regional;
            const r = 20 + n.trustScore * 8;
            return (
              <g key={n.nodeId}>
                <circle cx={center.x} cy={center.y} r={r} fill={meta.color} fillOpacity={0.3} stroke={meta.color} strokeWidth={2.5} />
                <text x={center.x} y={center.y + 4} fontSize="10" fill="#e4e4e7" textAnchor="middle" className="font-bold">{n.countryCode}</text>
                <text x={center.x} y={center.y + r + 14} fontSize="8" fill="#a78bfa" textAnchor="middle" className="font-medium">{n.name.split(" ")[0]}</text>
                <title>{n.name} — trust {(n.trustScore * 100).toFixed(0)}%</title>
              </g>
            );
          })}
        </svg>

        {/* Node detail cards */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {nodes.map((n) => {
            const meta = NODE_TYPE_META[n.nodeType] ?? NODE_TYPE_META.national;
            return (
              <div key={n.nodeId} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="size-3 rounded-full" style={{ background: meta.color }} />
                  <span className="text-[12px] font-semibold flex-1">{n.name}</span>
                  <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium",
                    n.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{n.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[9px] mt-1.5">
                  <div className="rounded bg-card/30 px-1.5 py-1"><span className="text-muted-foreground">Trust</span> <span className="font-mono font-semibold" style={{ color: meta.color }}>{(n.trustScore * 100).toFixed(0)}%</span></div>
                  <div className="rounded bg-card/30 px-1.5 py-1"><span className="text-muted-foreground">Treaties</span> <span className="font-mono font-semibold">{n.treatiesCount}</span></div>
                  <div className="rounded bg-card/30 px-1.5 py-1"><span className="text-muted-foreground">Shared</span> <span className="font-mono font-semibold">{n.assetsShared}</span></div>
                  <div className="rounded bg-card/30 px-1.5 py-1"><span className="text-muted-foreground">Consumed</span> <span className="font-mono font-semibold">{n.assetsConsumed}</span></div>
                </div>
                {n.lastSeenAt && <div className="text-[9px] text-muted-foreground mt-1">Last seen {timeAgo(n.lastSeenAt)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: FEDERATED IDENTITY (Trust Proofs)
// ===========================================================================

function IdentityTab() {
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation/identity").then((d) => setProofs(d.proofs)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <FileKey className="size-4 text-violet-400" />
        <span className="text-xs font-semibold">Federated Identity — Trust Proofs</span>
        <span className="text-[11px] text-muted-foreground">— trust is never copied, only proofs are exchanged</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{proofs.length} proofs</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {proofs.map((p) => (
          <div key={p.proofId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">{p.proofId}</span>
              <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] font-medium text-violet-300 capitalize">{p.subjectType}</span>
              {p.status === "active" ? <CheckCircle2 className="size-3 text-emerald-400" /> : <XCircle className="size-3 text-rose-400" />}
              <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(p.issuedAt)}</span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[12px] font-medium">{p.subjectName}</span>
              <span className="text-[10px] text-muted-foreground">({p.subjectId})</span>
            </div>
            {/* Trust flow visualization */}
            <div className="flex items-center gap-2 mb-1.5 text-[10px]">
              <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-center">
                <div className="text-[9px] text-muted-foreground">{p.issuingNodeName}</div>
                <div className="font-mono font-bold text-emerald-400">{p.homeTrustScore.toFixed(0)}</div>
                <div className="text-[8px] text-muted-foreground">home trust</div>
              </div>
              <div className="flex flex-col items-center">
                <FileKey className="size-3 text-violet-400" />
                <span className="text-[8px] text-violet-400 font-mono">{p.proofHash.slice(0, 10)}...</span>
              </div>
              <ArrowRight className="size-3 text-muted-foreground" />
              <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-center">
                <div className="text-[9px] text-muted-foreground">{p.receivingNodeId}</div>
                <div className="font-mono font-bold text-amber-400">{p.importedTrust.toFixed(0)}</div>
                <div className="text-[8px] text-muted-foreground">imported trust</div>
              </div>
              <div className="ml-auto flex flex-col gap-0.5 text-[9px] text-muted-foreground">
                <span>{p.confirmedEvents} confirmed events</span>
                <span>{p.sybilFlags} sybil flags</span>
                <span className="capitalize">verified: {p.verificationLevel}</span>
              </div>
            </div>
          </div>
        ))}
        {proofs.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileKey className="size-8 opacity-30" />
            <span className="text-xs">No trust proofs issued yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: ASSET EXCHANGE
// ===========================================================================

function AssetsTab() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation/assets").then((d) => setAssets(d.assets)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Package className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Federated Asset Exchange</span>
        <span className="text-[11px] text-muted-foreground">— cross-border asset listings (assets stay local)</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{assets.length} listings</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {assets.map((a) => {
          const licMeta = LICENSE_TYPE_META[a.licenseType] ?? { color: "#a1a1aa", label: a.licenseType };
          return (
            <div key={a.listingId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">{a.listingId}</span>
                <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium text-emerald-300">from: {a.homeNodeId}</span>
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: licMeta.color, background: `${licMeta.color}1a` }}>{licMeta.label}</span>
                {a.treatyCompliant && <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-400">✓ treaty compliant</span>}
                <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(a.listedAt)}</span>
              </div>
              <div className="text-[12px] font-medium mb-0.5">{a.assetTitle}</div>
              <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{a.assetDescription}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span>by <span className="font-medium text-foreground">{a.producerName}</span> ({a.producerType})</span>
                <span>category: {a.category}</span>
                <span>IQS <span className="font-mono font-semibold text-emerald-400">{(a.iqs * 100).toFixed(0)}%</span></span>
                <span>trust <span className="font-mono font-semibold">{(a.trustScore * 100).toFixed(0)}%</span></span>
                <span className="font-mono font-bold text-amber-400">{a.price === 0 ? "FREE" : `${a.price} IC`}</span>
                {a.crossBorderPurchases > 0 && <span className="text-cyan-400">{a.crossBorderPurchases} cross-border purchases</span>}
                {a.transferable && <span className="text-emerald-400">transferable</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: CROSS-BORDER MARKETS
// ===========================================================================

function MarketsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation/requests").then((d) => setRequests(d.requests)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Megaphone className="size-4 text-amber-400" />
        <span className="text-xs font-semibold">Cross-Border Intelligence Markets</span>
        <span className="text-[11px] text-muted-foreground">— regional intelligence requests across nodes</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{requests.length} requests</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {requests.map((r) => (
          <div key={r.requestId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">{r.requestId}</span>
              <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-300">{r.requesterName}</span>
              <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium",
                r.status === "open" ? "bg-emerald-500/10 text-emerald-300" : "bg-foreground/10 text-muted-foreground")}>{r.status}</span>
              <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(r.postedAt)}</span>
            </div>
            <div className="text-[12px] font-medium mb-0.5">{r.title}</div>
            <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{r.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="size-2.5" /> {r.geography}</span>
              <span>category: {r.category}</span>
              <span className="flex items-center gap-1 text-amber-400"><DollarSign className="size-2.5" /> {r.budget.toLocaleString()} IC budget</span>
              <span>{r.submissionCount} submissions · {r.acceptedCount} accepted</span>
            </div>
            {/* Participating nodes */}
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-muted-foreground">Participating nodes:</span>
              {r.participatingNodes.map((n: string) => (
                <span key={n} className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium text-emerald-300">{n}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: TREATIES
// ===========================================================================

function TreatiesTab() {
  const [treaties, setTreaties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation/treaties").then((d) => setTreaties(d.treaties)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <ScrollText className="size-4 text-rose-400" />
        <span className="text-xs font-semibold">Intelligence Treaties</span>
        <span className="text-[11px] text-muted-foreground">— governance as a package: what can be shared, what's restricted</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{treaties.length} treaties</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {treaties.map((t) => {
          const typeMeta = TREATY_TYPE_META[t.treatyType] ?? { color: "#a1a1aa", label: t.treatyType };
          return (
            <div key={t.treatyId} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">{t.treatyId}</span>
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: typeMeta.color, background: `${typeMeta.color}1a` }}>{typeMeta.label}</span>
                {t.status === "active" && <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-300">✓ active</span>}
                {t.signedAt && <span className="text-[9px] text-muted-foreground">signed {timeAgo(t.signedAt)}</span>}
              </div>
              <div className="text-[12px] font-medium mb-0.5">{t.name}</div>
              <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 mb-1.5">{t.description}</p>
              {/* Parties */}
              <div className="flex items-center gap-1 mb-1.5">
                <Handshake className="size-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Parties:</span>
                {t.partyNodeIds.map((p: string) => (
                  <span key={p} className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium text-emerald-300">{p}</span>
                ))}
              </div>
              {/* Allowed/restricted categories */}
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">
                  <div className="text-emerald-400 font-medium mb-0.5">✓ Allowed</div>
                  <div className="flex flex-wrap gap-0.5">
                    {t.allowedCategories.map((c: string) => (
                      <span key={c} className="rounded bg-emerald-500/10 px-1 py-0.5 text-emerald-300">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1">
                  <div className="text-rose-400 font-medium mb-0.5">✗ Restricted</div>
                  <div className="flex flex-wrap gap-0.5">
                    {t.restrictedCategories.map((c: string) => (
                      <span key={c} className="rounded bg-rose-500/10 px-1 py-0.5 text-rose-300">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Sovereignty flags */}
              <div className="flex items-center gap-2 mt-1.5 text-[9px] flex-wrap">
                <span className={cn("rounded px-1 py-0.5", t.onlyProofsExchanged ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>
                  {t.onlyProofsExchanged ? "✓" : "✗"} Only proofs exchanged
                </span>
                <span className={cn("rounded px-1 py-0.5", !t.citizenIdentitiesShared ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>
                  {!t.citizenIdentitiesShared ? "✓" : "⚠"} Citizen identities {t.citizenIdentitiesShared ? "shared" : "sovereign"}
                </span>
                <span className={cn("rounded px-1 py-0.5", !t.rawEvidenceShared ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>
                  {!t.rawEvidenceShared ? "✓" : "⚠"} Raw evidence {t.rawEvidenceShared ? "shared" : "local"}
                </span>
                <span className="text-muted-foreground ml-auto">revenue: {t.revenueSharingModel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: SYNC PROTOCOL
// ===========================================================================

function SyncTab() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/federation/sync").then((d) => setRuns(d.runs)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <RefreshCw className="size-4 text-cyan-400" />
        <span className="text-xs font-semibold">Federation Sync Protocol</span>
        <span className="text-[11px] text-muted-foreground">— audit trail of sync runs between nodes</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{runs.length} runs</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
        {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {runs.map((r) => (
          <div key={r.runId} className="rounded-lg border border-border bg-card/40 px-3 py-2 flex items-center gap-3">
            <RefreshCw className="size-4 text-cyan-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[10px] font-semibold text-cyan-300">{r.runId}</span>
                <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[9px] text-cyan-300">{r.syncType}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-medium text-emerald-400">{r.sourceNodeId}</span>
                <ArrowRight className="size-2.5" />
                <span className="font-medium text-amber-400">{r.targetNodeId}</span>
                <span>· {r.itemsSynced} synced</span>
                {r.itemsRejected > 0 && <span className="text-rose-400">· {r.itemsRejected} rejected</span>}
                {r.durationMs && <span>· {(r.durationMs / 1000).toFixed(1)}s</span>}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(r.startedAt)}</span>
          </div>
        ))}
        {runs.length === 0 && !loading && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="size-8 opacity-30" />
            <span className="text-xs">No sync runs yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
