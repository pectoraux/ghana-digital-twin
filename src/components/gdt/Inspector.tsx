"use client";

import { useGDT } from "@/lib/gdt/store";
import { fetchStats } from "@/lib/gdt/api";
import { REGIONS } from "@/lib/gdt/geo";
import { fmtInt, timeAgo } from "@/lib/gdt/format";
import { ObservationDetail } from "./ObservationDetail";
import { EntityDetail } from "./EntityDetail";
import { SectionLabel, StatusDot, MetricStat } from "./atoms";
import { cn } from "@/lib/utils";
import { X, Activity, Eye, Boxes, Database, Radio, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function Inspector() {
  const open = useGDT((s) => s.inspectorOpen);
  const selectedEntityId = useGDT((s) => s.selectedEntityId);
  const selectedObservationId = useGDT((s) => s.selectedObservationId);
  const selectEntity = useGDT((s) => s.selectEntity);
  const selectObservation = useGDT((s) => s.selectObservation);
  const toggleInspector = useGDT((s) => s.toggleInspector);
  const feed = useGDT((s) => s.feed);
  const setView = useGDT((s) => s.setView);

  const hasSelection = selectedEntityId || selectedObservationId;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 336, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="shrink-0 overflow-hidden border-l border-border bg-card/30"
        >
          <div className="flex h-full w-[336px] flex-col">
            {/* header */}
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
              <span className="text-[15px] font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedObservationId ? "Observation" : selectedEntityId ? "Entity" : "Overview"}
              </span>
              <button
                onClick={() => toggleInspector(false)}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {selectedObservationId ? (
                <ObservationDetail id={selectedObservationId} />
              ) : selectedEntityId ? (
                <EntityDetail id={selectedEntityId} />
              ) : (
                <Overview
                  feed={feed}
                  onOpenObs={(id) => selectObservation(id)}
                  onOpenEntity={(id) => selectEntity(id)}
                  onGoto={setView}
                />
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Overview({
  feed,
  onOpenObs,
  onOpenEntity,
  onGoto,
}: {
  feed: ReturnType<typeof useGDT.getState>["feed"];
  onOpenObs: (id: string) => void;
  onOpenEntity: (id: string) => void;
  onGoto: (v: "observations" | "entities" | "sources") => void;
}) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
  }, [feed.length]);

  const totalEntities = stats?.totalEntities ?? 0;
  const totalRels = stats?.totalRelationships ?? 0;
  const totalVersions = stats?.totalVersions ?? 0;
  const totalSources = stats?.totalSources ?? 0;

  return (
    <div className="flex h-full flex-col gdt-scroll overflow-y-auto p-3 gap-4">
      {/* hero status */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <StatusDot color="#34d399" pulse />
          <span className="text-[15px] font-semibold text-primary">WORLD MODEL · LIVE</span>
        </div>
        <p className="text-[16px] text-foreground/80 leading-relaxed">
          Continuously ingesting authoritative datasets and maintaining a versioned spatial model across{" "}
          <span className="font-medium text-foreground">{REGIONS.length} regions</span> of Ghana. Every entity has provenance.
        </p>
      </div>

      {/* metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricStat label="Entities" value={fmtInt(totalEntities)} sub="versioned" accent="#34d399" />
        <MetricStat label="Relationships" value={fmtInt(totalRels)} sub="spatial" accent="#2dd4bf" />
        <MetricStat label="Versions" value={fmtInt(totalVersions)} sub="historical" accent="#fbbf24" />
        <MetricStat label="Data sources" value={fmtInt(totalSources)} sub="registered" accent="#fb923c" />
      </div>

      {/* quick nav */}
      <div>
        <SectionLabel className="mb-2">Navigate</SectionLabel>
        <div className="grid grid-cols-1 gap-1">
          <QuickNav icon={Eye} label="Change Log" sub={`${fmtInt(totalVersions)} entity versions`} onClick={() => onGoto("observations")} />
          <QuickNav icon={Boxes} label="Entity registry" sub={`${fmtInt(totalEntities)} real entities`} onClick={() => onGoto("entities")} />
          <QuickNav icon={Database} label="Data pipeline" sub={`${fmtInt(totalSources)} registered sources`} onClick={() => onGoto("sources")} />
        </div>
      </div>

      {/* live feed */}
      <div className="min-h-0 flex-1 flex flex-col">
        <SectionLabel className="mb-2 flex items-center gap-1.5">
          <Activity className="size-3" /> Activity Feed
        </SectionLabel>
        <div className="space-y-1 gdt-scroll overflow-y-auto pr-1">
          {feed.map((f) => (
            <button
              key={f.id}
              onClick={() => f.obsId && onOpenObs(f.obsId)}
              className={cn(
                "w-full text-left rounded-md border border-border bg-card/40 px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-card",
                f.obsId && "cursor-pointer"
              )}
            >
              <div className="flex items-center gap-2">
                <StatusDot
                  color={f.level === "crit" ? "#f43f5e" : f.level === "warn" ? "#fbbf24" : "#34d399"}
                  pulse={f.level === "crit"}
                />
                <span className="flex items-center gap-1 text-[15px] font-medium text-foreground/90 flex-1 truncate">
                  {f.kind === "observation" && <Zap className="size-3 text-rose-400" />}
                  {f.kind === "ingest" && <Database className="size-3 text-amber-400" />}
                  {f.kind === "inference" && <Radio className="size-3 text-emerald-400" />}
                  {f.text}
                </span>
                <span className="text-[13px] text-muted-foreground font-mono">{timeAgo(new Date(f.time).toISOString())}</span>
              </div>
              {f.detail && <div className="text-[14px] text-muted-foreground mt-0.5 pl-5">{f.detail}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickNav({
  icon: Icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-lg border border-border bg-card/40 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-card"
    >
      <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-medium">{label}</div>
        <div className="text-[14px] text-muted-foreground truncate">{sub}</div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  );
}
