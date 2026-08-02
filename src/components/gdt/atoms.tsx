"use client";

import { cn } from "@/lib/utils";
import { confidenceColor, confidenceLabel } from "@/lib/gdt/format";

export function ConfidenceBar({
  value,
  className,
  showLabel = true,
  size = "md",
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const color = confidenceColor(value);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "h-1.5 flex-1 rounded-full bg-foreground/10 overflow-hidden",
          size === "sm" && "h-1"
        )}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value * 100}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
        />
      </div>
      {showLabel && (
        <span className="text-[14px] font-mono tnum text-muted-foreground tabular-nums w-9 text-right">
          {(value * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

export function ConfidencePill({ value }: { value: number }) {
  const color = confidenceColor(value);
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[14px] font-medium font-mono tnum"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {confidenceLabel(value)} · {(value * 100).toFixed(0)}%
    </span>
  );
}

export function StatusDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 gdt-blink"
          style={{ background: color }}
        />
      )}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function MetricStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
      <div className="text-[14px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className="text-lg font-semibold tnum mt-0.5"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[14px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function Sparkline({
  data,
  color = "#34d399",
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map((d, i) => `${(i * step).toFixed(1)},${(height - ((d - min) / range) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r={2}
        fill={color}
      />
    </svg>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-[14px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80",
        className
      )}
    >
      {children}
    </div>
  );
}
