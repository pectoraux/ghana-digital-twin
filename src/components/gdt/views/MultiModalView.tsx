"use client";

import { useEffect, useState } from "react";
import { fetchModalities, fetchFeatureStore, fetchTwinStates, fetchMultiModalFusion, extractFeatures } from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot, ConfidenceBar } from "@/components/gdt/atoms";
import { timeAgo } from "@/lib/gdt/format";
import {
  Layers3,
  Loader2,
  Zap,
  Radar,
  Satellite,
  CloudRain,
  Mountain,
  Waves,
  Building2,
  Activity,
  Target,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  optical: Satellite,
  sar: Radar,
  thermal: Activity,
  weather: CloudRain,
  dem: Mountain,
  hydrology: Waves,
  infrastructure: Building2,
  human_activity: Building2,
};

const CATEGORY_COLORS: Record<string, string> = {
  optical: "#34d399",
  sar: "#a78bfa",
  thermal: "#fb923c",
  weather: "#22d3ee",
  dem: "#fbbf24",
  hydrology: "#2dd4bf",
  infrastructure: "#94a3b8",
  human_activity: "#84cc16",
};

export function MultiModalView() {
  const [modalities, setModalities] = useState<any[]>([]);
  const [modStats, setModStats] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [featStats, setFeatStats] = useState<any>(null);
  const [twinStates, setTwinStates] = useState<any[]>([]);
  const [twinStats, setTwinStats] = useState<any>(null);
  const [fusion, setFusion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([fetchModalities(), fetchFeatureStore(undefined, 20), fetchTwinStates()])
      .then(([m, f, t]) => {
        setModalities(m.modalities);
        setModStats(m.stats);
        setFeatures(f.vectors);
        setFeatStats(f.stats);
        setTwinStates(t.states);
        setTwinStats(t.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleExtract = async () => {
    setExtracting(true);
    try { await extractFeatures(20); } finally { setExtracting(false); load(); }
  };

  const handleFuse = async (tileId: string) => {
    const result = await fetchMultiModalFusion(tileId);
    setFusion(result);
  };

  return (
    <div className="flex h-full w-full">
      {/* Left: modalities + feature store + twin states */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Layers3 className="size-4 text-primary" /> Multi-Modal Evidence Fusion
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {modStats?.total ?? 0} modalities · {featStats?.totalVectors ?? 0} feature vectors
            </span>
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {extracting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
              Extract Features
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Modalities" value={modStats?.total ?? 0} sub={`${modStats?.active ?? 0} active`} accent="#34d399" />
            <MetricStat label="Feature vectors" value={featStats?.totalVectors ?? 0} sub={`${featStats?.tilesCovered ?? 0} tiles`} accent="#a78bfa" />
            <MetricStat label="Data completeness" value={`${((featStats?.avgDataCompleteness ?? 0) * 100).toFixed(0)}%`} sub="avg across modalities" accent="#22d3ee" />
            <MetricStat label="Twin states" value={twinStats?.total ?? 0} sub={`${twinStats?.critical ?? 0} critical risk`} accent="#f43f5e" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-4 space-y-4">
          {/* modality registry */}
          <div>
            <SectionLabel className="mb-2">Sensing Modalities ({modalities.length})</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {modalities.map((m) => {
                const Icon = CATEGORY_ICONS[m.category] ?? Activity;
                const color = CATEGORY_COLORS[m.category] ?? "#a1a1aa";
                return (
                  <div key={m.modalityId} className={cn("rounded-lg border px-3 py-2", m.status === "active" ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card/40")}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className="size-3.5" style={{ color }} />
                      <span className="text-[15px] font-medium truncate flex-1">{m.name}</span>
                      <StatusDot color={m.status === "active" ? "#34d399" : "#71717a"} pulse={m.status === "active"} />
                    </div>
                    <div className="text-[13px] text-muted-foreground flex items-center gap-2">
                      <span>{m.resolution}</span>
                      <span>·</span>
                      <span>{m.cadence}</span>
                      <span>·</span>
                      <span>{m.featuresProvided.length} features</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground/70 mt-0.5 line-clamp-1">{m.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* twin states (risk map) */}
          {twinStates.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Digital Twin State ({twinStates.length} cells)</SectionLabel>
              <div className="space-y-1 max-h-48 overflow-y-auto gdt-scroll">
                {twinStates.slice(0, 15).map((s) => {
                  const riskColor = s.riskLevel === "critical" ? "#f43f5e" : s.riskLevel === "high" ? "#fb923c" : s.riskLevel === "moderate" ? "#fbbf24" : "#34d399";
                  return (
                    <button
                      key={s.tileId}
                      onClick={() => handleFuse(s.tileId)}
                      className="group flex w-full items-center gap-2 rounded-md border border-border bg-card/30 px-2.5 py-1.5 text-left hover:border-primary/30 hover:bg-card/50"
                    >
                      <span className="size-2 rounded-full" style={{ background: riskColor }} />
                      <span className="font-mono text-[14px] text-muted-foreground truncate flex-1">{s.tileId}</span>
                      <span className="text-[13px]" style={{ color: riskColor }}>{s.riskLevel}</span>
                      <span className="font-mono text-[13px] text-muted-foreground">risk {(s.riskScore * 100).toFixed(0)}%</span>
                      <span className="text-[13px] text-muted-foreground">{s.observationCount} obs</span>
                      <span className="text-[13px] text-muted-foreground capitalize">{s.season}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* loading */}
          {loading && (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}

          {/* architecture explanation */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Layers3 className="size-4 text-primary" />
              <span className="text-[15px] font-semibold text-primary">UNIFIED EVIDENCE SPACE</span>
            </div>
            <p className="text-[16px] text-foreground/80 leading-relaxed">
              Instead of reasoning from optical imagery alone, the platform fuses evidence from ALL sensing modalities:
              optical (Sentinel-2), SAR (Sentinel-1), thermal (Landsat), weather (CHIRPS/ERA5), DEM (SRTM), hydrology,
              and human activity (night lights, population). SAR sees through clouds. Rainfall explains river color.
              DEM explains erosion. This dramatically reduces false positives and makes every hypothesis stronger.
            </p>
          </div>
        </div>
      </div>

      {/* Right: multi-modal fusion assessment */}
      <div className="hidden w-[340px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Target className="size-3.5 text-primary" /> Multi-Modal Assessment
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3">
          {!fusion ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Layers3 className="size-8 opacity-30" />
              <span className="text-xs text-center">Click a twin state cell to fuse<br />multi-modal evidence</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* assessment header */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="text-[14px] font-semibold text-primary mb-1">FUSED ASSESSMENT</div>
                <p className="text-[15px] text-foreground/90 leading-relaxed">{fusion.assessment}</p>
              </div>

              {/* fusion metrics */}
              <div className="grid grid-cols-2 gap-2">
                <MetricStat label="Modalities" value={fusion.modalityCount} accent="#34d399" />
                <MetricStat label="Evidence" value={fusion.evidence.length} accent="#a78bfa" />
                <MetricStat label="Fused signal" value={`${(fusion.fusedSignal * 100).toFixed(0)}%`} accent="#fbbf24" />
                <MetricStat label="Agreement" value={`${(fusion.crossModalAgreement * 100).toFixed(0)}%`} sub="cross-modal" accent="#2dd4bf" />
              </div>

              {/* evidence breakdown by modality */}
              <div>
                <SectionLabel className="mb-2">Evidence Breakdown</SectionLabel>
                <div className="space-y-1.5">
                  {fusion.evidence.map((e: any, i: number) => {
                    const color = CATEGORY_COLORS[e.modality.split("-")[0]] ?? "#a1a1aa";
                    const Icon = CATEGORY_ICONS[e.modality.split("-")[0]] ?? Activity;
                    return (
                      <div key={i} className="rounded-md border border-border bg-card/40 p-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className="size-3" style={{ color }} />
                          <span className="text-[14px] font-medium">{e.feature}</span>
                          <span className="ml-auto font-mono text-[13px] text-muted-foreground">signal {(e.signal * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-[13px] text-muted-foreground">{e.description}</div>
                        {/* signal bar */}
                        <div className="mt-1 h-0.5 rounded-full bg-foreground/8 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${e.signal * 100}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* confidence */}
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Fused confidence</span>
                  <span className="font-mono tnum font-semibold">{(fusion.fusedConfidence * 100).toFixed(0)}%</span>
                </div>
                <ConfidenceBar value={fusion.fusedConfidence} showLabel={false} />
              </div>

              {/* explanation */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  Multi-modal fusion combines evidence from ALL sensing modalities. Each modality compensates for the
                  others' limitations: SAR sees through clouds, weather explains seasonal patterns, DEM predicts erosion risk.
                  Cross-modal agreement strengthens confidence; disagreement flags uncertainty.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
