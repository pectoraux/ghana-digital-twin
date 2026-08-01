"use client";

import { useEffect, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { ENTITIES } from "@/lib/gdt/entities";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { DATA_SOURCES } from "@/lib/gdt/sources";
import { formatCoord } from "@/lib/gdt/geo";
import { fmtInt } from "@/lib/gdt/format";
import { StatusDot } from "./atoms";
import { Cpu, HardDrive, Wifi, Globe2, Layers } from "lucide-react";

export function StatusBar() {
  const cursorCoord = useGDT((s) => s.cursorCoord);
  const view = useGDT((s) => s.view);
  const feed = useGDT((s) => s.feed);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const healthy = DATA_SOURCES.filter((s) => s.status === "healthy").length;
  const total = DATA_SOURCES.length;
  const storage = DATA_SOURCES.reduce((a, s) => a + s.storageTB, 0).toFixed(1);

  const latest = feed[0];

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card/50 px-3 text-[10px] font-mono text-muted-foreground tnum">
      <span className="flex items-center gap-1.5">
        <StatusDot color="#34d399" pulse />
        <span className="text-foreground/80">SYSTEM NOMINAL</span>
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <Globe2 className="size-3" />
        {cursorCoord ? formatCoord(cursorCoord) : "— , —"}
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <Wifi className="size-3" />
        {healthy}/{total} sources healthy
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <HardDrive className="size-3" />
        {storage} TB
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <Layers className="size-3" />
        {fmtInt(ENTITIES.length)} entities · {fmtInt(OBSERVATIONS.length)} obs
      </span>

      {/* Live feed ticker */}
      {latest && (
        <span className="hidden md:flex items-center gap-1.5 ml-2 min-w-0">
          <span className="text-border">│</span>
          <StatusDot
            color={latest.level === "crit" ? "#f43f5e" : latest.level === "warn" ? "#fbbf24" : "#34d399"}
            pulse={latest.level === "crit"}
          />
          <span className="truncate text-foreground/70">{latest.text}</span>
          {latest.detail && <span className="text-muted-foreground/60">· {latest.detail}</span>}
        </span>
      )}

      <span className="ml-auto flex items-center gap-1">
        <Cpu className="size-3" />
        gdt-engine
      </span>
      <span className="text-border">│</span>
      <span className="tabular-nums">{now.toUTCString().slice(17, 25)} UTC</span>
    </footer>
  );
}
