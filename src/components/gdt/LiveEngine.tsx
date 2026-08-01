"use client";

import { useEffect } from "react";
import { useGDT } from "@/lib/gdt/store";
import { toast } from "sonner";
import { REGIONS } from "@/lib/gdt/geo";
import { OBS_META } from "@/lib/gdt/format";
import type { ObservationType } from "@/lib/gdt/types";

const SYNTHETIC_OBS: { type: ObservationType; text: string; detail: string }[] = [
  { type: "excavation_signature", text: "New excavation signature detected", detail: "Western belt · 1.8 ha" },
  { type: "water_discoloration", text: "Turbidity anomaly flagged", detail: "Pra River · z=+2.7" },
  { type: "vegetation_loss", text: "Canopy loss detected", detail: "Atewa buffer · 0.9 ha" },
  { type: "new_waterbody", text: "New mined water body appeared", detail: "Bogoso reach · 0.4 ha" },
  { type: "deforestation", text: "Forest clearing detected", detail: "Bia buffer · 1.2 ha" },
  { type: "new_road", text: "New unpaved road detected", detail: "Sefwi corridor · 1.6 km" },
  { type: "surface_disturbance", text: "Surface disturbance flagged", detail: "Wassa Amenfi · 2.3 ha" },
  { type: "settlement_growth", text: "Built-up expansion tracked", detail: "Kumasi fringe · 6.4 ha" },
];

const INGEST_EVENTS = [
  { source: "Sentinel-2 L2A", detail: "2 scenes, cloud-mask 8.1%" },
  { source: "Sentinel-1 GRD", detail: "3 scenes, coherence computed" },
  { source: "Dynamic World", detail: "probability cube appended" },
  { source: "ERA5 Reanalysis", detail: "168 hourly timesteps" },
  { source: "CHIRPS Rainfall", detail: "daily mosaic complete" },
  { source: "OpenStreetMap", detail: "+1,204 features applied" },
];

const INFERENCE_EVENTS = [
  { model: "gdt-cv-excav-v4.2", detail: "412 tiles → 6 detections" },
  { model: "gdt-cv-defor-v3.4", detail: "288 tiles → 3 detections" },
  { model: "gdt-hydro-turb-v2.1", detail: "river scan → 2 anomalies" },
  { model: "gdt-cv-water-v3.1", detail: "flood mask updated" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function LiveEngine() {
  const pushFeed = useGDT((s) => s.pushFeed);
  const selectObservation = useGDT((s) => s.selectObservation);

  useEffect(() => {
    // initial small delay
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      // jittered interval 12s–22s
      const delay = 12000 + Math.random() * 10000;
      timer = setTimeout(() => {
        const roll = Math.random();
        if (roll < 0.45) {
          // new observation
          const o = pick(SYNTHETIC_OBS);
          const region = pick(REGIONS);
          const om = OBS_META[o.type];
          pushFeed({
            kind: "observation",
            text: o.text,
            detail: `${region.name} · ${o.detail}`,
            level: o.type === "excavation_signature" || o.type === "deforestation" ? "crit" : "warn",
            obsId: undefined,
          });
          toast.custom(
            (t) => (
              <div
                className="pointer-events-auto flex w-[330px] items-start gap-2.5 rounded-lg border border-border bg-card/95 backdrop-blur p-3 shadow-xl"
                onClick={() => {
                  selectObservation(undefined);
                  toast.dismiss(t);
                }}
              >
                <span
                  className="mt-0.5 size-2 shrink-0 rounded-full"
                  style={{ background: om.color, boxShadow: `0 0 10px ${om.color}` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {om.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">· just now</span>
                  </div>
                  <div className="text-[13px] font-medium leading-snug mt-0.5">{o.text}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {region.name} · {o.detail}
                  </div>
                </div>
              </div>
            ),
            { duration: 6000 }
          );
        } else if (roll < 0.75) {
          const e = pick(INGEST_EVENTS);
          pushFeed({ kind: "ingest", text: `${e.source} ingested`, detail: e.detail, level: "info" });
        } else {
          const e = pick(INFERENCE_EVENTS);
          pushFeed({ kind: "inference", text: `${e.model} batch complete`, detail: e.detail, level: "info" });
        }
        schedule();
      }, delay);
    };

    schedule();
    return () => clearTimeout(timer);
  }, [pushFeed, selectObservation]);

  return null;
}
