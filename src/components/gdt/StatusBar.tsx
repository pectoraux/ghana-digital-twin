"use client";

import { useEffect, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { fetchStats } from "@/lib/gdt/api";
import { formatCoord } from "@/lib/gdt/geo";
import { fmtInt } from "@/lib/gdt/format";
import { StatusDot } from "./atoms";
import { Cpu, HardDrive, Wifi, Globe2, Layers } from "lucide-react";

export function StatusBar() {
  const cursorCoord = useGDT((s) => s.cursorCoord);
  const feed = useGDT((s) => s.feed);
  const [now, setNow] = useState(() => new Date());
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    fetchStats().then(setStats).catch(() => {});
    const t2 = setInterval(() => fetchStats().then(setStats).catch(() => {}), 15000);
    return () => {
      clearInterval(t);
      clearInterval(t2);
    };
  }, []);

  const totalEntities = stats?.totalEntities ?? 0;
  const totalRels = stats?.totalRelationships ?? 0;
  const totalSources = stats?.totalSources ?? 0;
  const latest = feed[0];

  return (
    <footer className="hidden md:flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card/50 px-3 text-[14px] font-mono text-muted-foreground tnum">
      <span className="flex items-center gap-1.5">
        <StatusDot color="#34d399" pulse />
        <span className="text-foreground/80">WORLD MODEL NOMINAL</span>
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <Globe2 className="size-3" />
        {cursorCoord ? formatCoord(cursorCoord) : "— , —"}
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <Wifi className="size-3" />
        {totalSources} sources registered
      </span>

      <span className="text-border">│</span>

      <span className="flex items-center gap-1">
        <Layers className="size-3" />
        {fmtInt(totalEntities)} entities · {fmtInt(totalRels)} relationships
      </span>

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
        gdt-worldmodel
      </span>
      <span className="text-border">│</span>
      <span className="text-muted-foreground font-mono text-[12px]">v4.2.0</span>
      <span className="text-border">│</span>
      <span className="tabular-nums">{now.toUTCString().slice(17, 25)} UTC</span>
    </footer>
  );
}
