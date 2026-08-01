"use client";

import { useGDT } from "@/lib/gdt/store";
import { observationById, OBSERVATIONS } from "@/lib/gdt/observations";
import { entityById } from "@/lib/gdt/entities";
import { REGIONS } from "@/lib/gdt/geo";
import {
  OBS_META,
  SEVERITY_META,
  STATUS_META,
  fmtArea,
  fmtDateTime,
  timeAgo,
  confidenceLabel,
} from "@/lib/gdt/format";
import type { ObservationType } from "@/lib/gdt/types";
import { ConfidenceBar, SectionLabel, StatusDot } from "./atoms";
import { EvidencePanel } from "./SyntheticImagery";
import { entityColor } from "@/lib/gdt/format";
import { ChevronRight, MapPin, Cpu, GitBranch, Layers, FileText, Ruler, Box } from "lucide-react";
import { cn } from "@/lib/utils";

const SCENE_MAP: Record<ObservationType, Parameters<typeof EvidencePanel>[0]["scene"]> = {
  excavation_signature: "excavation",
  surface_disturbance: "excavation",
  new_waterbody: "waterbody_new",
  water_discoloration: "turbidity",
  vegetation_loss: "forest_clearing",
  deforestation: "deforestation",
  new_road: "generic",
  construction: "settlement_growth",
  settlement_growth: "settlement_growth",
  shoreline_change: "generic",
  river_morphology: "generic",
  land_cover_change: "deforestation",
};

export function ObservationDetail({ id }: { id: string }) {
  const obs = observationById(id);
  const selectEntity = useGDT((s) => s.selectEntity);
  const setView = useGDT((s) => s.setView);

  if (!obs) return null;
  const om = OBS_META[obs.type];
  const sev = SEVERITY_META[obs.severity];
  const st = STATUS_META[obs.status];
  const region = REGIONS.find((r) => r.id === obs.regionId);

  return (
    <div className="flex h-full flex-col gdt-scroll overflow-y-auto">
      {/* header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: om.color, background: `${om.color}1a`, border: `1px solid ${om.color}33` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: om.color }} />
            {om.label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: sev.color, background: `${sev.color}1a` }}
          >
            {sev.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-foreground/5">
            <StatusDot color={st.color} pulse={obs.status === "active"} />
            {st.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-muted-foreground">{obs.id.toUpperCase()}</span>
          <span className="text-[10px] text-muted-foreground">· {timeAgo(obs.timestamp)}</span>
        </div>
        <h2 className="text-[15px] font-semibold leading-snug text-balance">{obs.title}</h2>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* summary */}
        <p className="text-[12.5px] leading-relaxed text-foreground/85">{obs.summary}</p>

        {/* key facts grid */}
        <div className="grid grid-cols-2 gap-2">
          <Fact icon={MapPin} label="Location" value={region?.name ?? "—"} />
          <Fact icon={Ruler} label="Area affected" value={fmtArea(obs.areaAffectedHa)} />
          <Fact icon={Cpu} label="Model" value={obs.modelVersion} mono />
          <Fact icon={Box} label="Confidence" value={`${(obs.confidence * 100).toFixed(0)}% · ${confidenceLabel(obs.confidence)}`} />
        </div>

        {/* evidence */}
        <div>
          <SectionLabel className="mb-2">Supporting Evidence</SectionLabel>
          <EvidencePanel
            scene={SCENE_MAP[obs.type]}
            seed={parseInt(obs.id.replace(/\D/g, "")) || 1}
            beforeDate={obs.beforeDate}
            afterDate={obs.afterDate}
            changeLabel={fmtArea(obs.areaAffectedHa)}
          />
        </div>

        {/* confidence + evidence sources */}
        <div>
          <SectionLabel className="mb-2">Confidence Breakdown</SectionLabel>
          <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Overall</span>
              <span className="font-mono tnum font-semibold" style={{ color: obs.confidence >= 0.9 ? "#34d399" : obs.confidence >= 0.75 ? "#fbbf24" : "#fb923c" }}>
                {(obs.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <ConfidenceBar value={obs.confidence} showLabel={false} />
            <div className="pt-1.5 space-y-1.5">
              {obs.evidence.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="size-1.5 rounded-full" style={{ background: om.color }} />
                  <span className="flex-1 truncate">{e.dataset}{e.bands ? ` · ${e.bands}` : ""}</span>
                  <span className="font-mono tnum text-muted-foreground">{(e.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* reasoning */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <FileText className="size-3" /> Reasoning
          </SectionLabel>
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <p className="text-[12px] leading-relaxed text-foreground/85">{obs.reasoning}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <GitBranch className="size-3" />
              {obs.pipeline}
            </div>
          </div>
        </div>

        {/* affected entities */}
        {obs.affectedEntities.length > 0 && (
          <div>
            <SectionLabel className="mb-2">Affected Entities</SectionLabel>
            <div className="space-y-1">
              {obs.affectedEntities.map((eid) => {
                const e = entityById(eid);
                if (!e) return null;
                return (
                  <button
                    key={eid}
                    onClick={() => {
                      selectEntity(eid);
                      setView("entities");
                    }}
                    className="group flex w-full items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
                  >
                    <span className="size-2 rounded-full" style={{ background: entityColor(e.kind) }} />
                    <span className="flex-1 text-[12px] truncate">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground">{e.kind}</span>
                    <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* attributes */}
        <div>
          <SectionLabel className="mb-2">Detected Attributes</SectionLabel>
          <div className="rounded-lg border border-border bg-card/40 divide-y divide-border">
            {Object.entries(obs.attributes).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                <span className="text-muted-foreground font-mono">{k}</span>
                <span className="font-mono tnum text-foreground/90">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* supporting datasets */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Layers className="size-3" /> Supporting Datasets
          </SectionLabel>
          <div className="flex flex-wrap gap-1">
            {obs.supportingDatasets.map((d) => (
              <span key={d} className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* timestamps */}
        <div className="text-[10px] text-muted-foreground font-mono space-y-0.5 pt-1 border-t border-border">
          <div>detected: {fmtDateTime(obs.detectedAt)}</div>
          <div>event ts: {fmtDateTime(obs.timestamp)}</div>
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-2.5" /> {label}
      </div>
      <div className={cn("text-[12px] font-medium mt-0.5 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}
