"use client";

import { useEffect, useState } from "react";
import { fetchExtensions, toggleExtension, fetchExtensionLifecycle, runExtensionTests, installAdvancedFeatures } from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel, MetricStat, StatusDot } from "@/components/gdt/atoms";
import {
  Puzzle,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  Tag,
  Cpu,
  Eye,
  Plane,
  Bell,
  Brain,
  Settings2,
  ChevronRight,
  GitBranch,
  Workflow,
  Gauge,
  FlaskConical,
  FileCheck,
  Zap,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  mining: Cpu,
  flood: Eye,
  agriculture: Tag,
  forestry: Cpu,
  infrastructure: Settings2,
  biodiversity: Tag,
  custom: Puzzle,
};

export function ExtensionsView() {
  const [extensions, setExtensions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<any>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const load = () => {
    setLoading(true);
    fetchExtensions()
      .then((r) => {
        setExtensions(r.extensions);
        setStats(r.stats);
        if (r.extensions.length > 0 && !selectedId) setSelectedId(r.extensions[0].extensionId);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // fetch lifecycle info when selection changes
  useEffect(() => {
    if (!selectedId) { setLifecycle(null); return; }
    let active = true;
    Promise.resolve().then(() => { if (active) setLifecycleLoading(true); });
    fetchExtensionLifecycle(selectedId)
      .then((d) => { if (active) { setLifecycle(d); setLifecycleLoading(false); } })
      .catch(() => { if (active) setLifecycleLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  const handleToggle = async (extensionId: string, currentStatus: string) => {
    setToggling(extensionId);
    try {
      const action = currentStatus === "enabled" ? "disable" : "enable";
      await toggleExtension(extensionId, action);
    } finally { setToggling(null); load(); }
  };

  const handleRunTests = async () => {
    if (!selectedId) return;
    setTesting(true);
    try {
      const result = await runExtensionTests(selectedId);
      setTestResults(result);
    } finally { setTesting(false); }
  };

  const handleInstallAdvanced = async () => {
    setTesting(true);
    try { await installAdvancedFeatures(); } finally { setTesting(false); load(); }
  };

  const selected = extensions.find((e) => e.extensionId === selectedId);
  const manifest = selected?.manifest;

  return (
    <div className="flex h-full w-full">
      {/* Left: extension list */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Puzzle className="size-4 text-primary" /> Extension Platform
            </h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
              {stats?.total ?? 0} extensions · {stats?.enabled ?? 0} enabled · {stats?.totalRules ?? 0} rules
            </span>
            <p className="text-[15px] text-muted-foreground hidden lg:block">
              Domain expertise as installable extensions · like VS Code for environmental intelligence
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Extensions" value={stats?.total ?? 0} accent="#a78bfa" />
            <MetricStat label="Enabled" value={stats?.enabled ?? 0} sub="active" accent="#34d399" />
            <MetricStat label="Rules" value={stats?.totalRules ?? 0} sub="domain-specific" accent="#fbbf24" />
            <MetricStat label="Categories" value={stats?.categories?.length ?? 0} sub="domains" accent="#22d3ee" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3 space-y-1.5">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {extensions.map((ext) => {
            const isSel = ext.extensionId === selectedId;
            const isEnabled = ext.status === "enabled" || ext.status === "installed";
            return (
              <button
                key={ext.extensionId}
                onClick={() => setSelectedId(ext.extensionId)}
                className={cn(
                  "group flex w-full items-stretch gap-3 rounded-lg border bg-card/40 px-3 py-2.5 text-left transition-all",
                  isSel ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30 hover:bg-card/60"
                )}
              >
                <div className="w-1 shrink-0 rounded-full" style={{ background: ext.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[17px] font-medium truncate flex-1">{ext.name}</span>
                    <span className="font-mono text-[13px] text-muted-foreground">v{ext.version}</span>
                    <StatusDot color={isEnabled ? "#34d399" : "#71717a"} pulse={isEnabled} />
                    <span className={cn("rounded px-1 py-0.5 text-[13px] font-semibold", isEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-foreground/5 text-muted-foreground")}>
                      {ext.status}
                    </span>
                  </div>
                  <div className="text-[15px] text-muted-foreground line-clamp-1">{ext.description}</div>
                  <div className="mt-1 flex items-center gap-3 text-[14px] text-muted-foreground">
                    <span>{ext.ruleCount} rules</span>
                    <span>{ext.hypothesisTypes?.length || 0} hypotheses</span>
                    <span>{ext.missionTypes?.length || 0} missions</span>
                    <span>{ext.tags?.length || 0} tags</span>
                    {ext.isSigned && <span className="flex items-center gap-0.5 text-emerald-400"><Shield className="size-2.5" /> signed</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: extension detail */}
      <div className="hidden w-[340px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Settings2 className="size-3.5 text-primary" /> Extension Detail
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto gdt-scroll p-3">
          {!selected || !manifest ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Puzzle className="size-8 opacity-30" />
              <span className="text-xs">Select an extension to inspect</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[14px] font-semibold" style={{ color: selected.color, background: `${selected.color}1a` }}>
                    {selected.category}
                  </span>
                  <span className="font-mono text-[14px] text-muted-foreground">v{selected.version}</span>
                </div>
                <h4 className="text-[18px] font-semibold">{selected.name}</h4>
                <p className="text-[15px] text-muted-foreground mt-0.5">by {selected.author}</p>
              </div>

              {/* enable/disable */}
              <button
                onClick={() => handleToggle(selected.extensionId, selected.status)}
                disabled={toggling === selected.extensionId}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors disabled:opacity-50",
                  selected.status === "enabled"
                    ? "border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
                    : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
                )}
              >
                {toggling === selected.extensionId ? <Loader2 className="size-3.5 animate-spin" /> :
                  selected.status === "enabled" ? <XCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                {selected.status === "enabled" ? "Disable Extension" : "Enable Extension"}
              </button>

              {/* description */}
              <p className="text-[16px] text-foreground/80 leading-relaxed">{manifest.description}</p>

              {/* permissions */}
              <div>
                <SectionLabel className="mb-2 flex items-center gap-1.5">
                  <Shield className="size-3" /> Permissions
                </SectionLabel>
                <div className="space-y-1.5">
                  <PermRow icon={Eye} label="Datasets" values={manifest.permissions.datasets} color="#34d399" />
                  <PermRow icon={Cpu} label="Compute" values={manifest.permissions.compute} color="#fbbf24" />
                  <PermRow icon={Settings2} label="UI" values={manifest.permissions.ui} color="#22d3ee" />
                  <PermRow icon={Plane} label="Missions" values={manifest.permissions.missions} color="#fb923c" />
                  <div className="flex items-center gap-2 text-[14px]">
                    <Bell className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Alerts:</span>
                    <span className={manifest.permissions.alerts ? "text-emerald-400" : "text-muted-foreground"}>{manifest.permissions.alerts ? "enabled" : "disabled"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[14px]">
                    <Brain className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Learning:</span>
                    <span className={manifest.permissions.learning ? "text-emerald-400" : "text-muted-foreground"}>{manifest.permissions.learning ? "enabled" : "disabled"}</span>
                  </div>
                </div>
              </div>

              {/* contributes */}
              <div>
                <SectionLabel className="mb-2">Contributes</SectionLabel>
                <div className="space-y-1">
                  {manifest.contributes.rules.map((r: any) => (
                    <div key={r.ruleId} className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded px-1 py-0.5 text-[13px] font-semibold", r.effect === "boost" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>{r.effect}</span>
                        <span className="text-[14px] font-medium truncate flex-1">{r.name}</span>
                        <span className="font-mono text-[13px] text-muted-foreground">LR={r.likelihoodRatio}</span>
                      </div>
                      <div className="text-[13px] text-muted-foreground mt-0.5">→ {r.hypothesisType.replace(/_/g, " ")}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* hypothesis types */}
              <div>
                <SectionLabel className="mb-2">Hypothesis Types</SectionLabel>
                <div className="space-y-1">
                  {manifest.contributes.hypothesisTypes.map((h: any) => (
                    <div key={h.type} className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
                      <div className="text-[15px] font-medium">{h.label}</div>
                      <div className="text-[13px] text-muted-foreground">prior: {(h.prior * 100).toFixed(0)}% · {h.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* mission types */}
              <div>
                <SectionLabel className="mb-2">Mission Types</SectionLabel>
                <div className="space-y-1">
                  {manifest.contributes.missionTypes.map((m: any) => (
                    <div key={m.type} className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1 text-[14px]">
                      <span className="font-medium flex-1">{m.label}</span>
                      <span className="text-muted-foreground">{m.baseCost === 0 ? "free" : `$${m.baseCost}`}</span>
                      <span className="text-muted-foreground">gain {(m.baseInfoGain * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* trust */}
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="size-3 text-emerald-400" />
                  <span className="text-[14px] font-semibold text-emerald-400">TRUST</span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-muted-foreground">Signed: {selected.isSigned ? "✓" : "✗"}</span>
                  <span className="text-muted-foreground">Verified: {selected.isVerified ? "✓" : "✗"}</span>
                  <span className="font-mono">{(selected.trustScore * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* lifecycle hooks + pipeline */}
              {lifecycle && !lifecycleLoading && (
                <>
                  {/* hooks */}
                  {lifecycle.hooks?.length > 0 && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <Workflow className="size-3" /> Lifecycle Hooks ({lifecycle.hooks.length})
                      </SectionLabel>
                      <div className="space-y-0.5">
                        {lifecycle.hooks.map((h: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card/30 px-2 py-1 text-[14px]">
                            <span className="font-mono text-primary/70 w-20">{h.hookName}</span>
                            <span className="text-muted-foreground">{h.hookType}</span>
                            <span className="ml-auto font-mono text-muted-foreground">p{h.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* pipeline */}
                  {lifecycle.pipelines?.length > 0 && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <GitBranch className="size-3" /> Declarative Pipeline ({lifecycle.pipelines[0].stageCount} stages)
                      </SectionLabel>
                      <div className="rounded-lg border border-border bg-background/60 p-2 space-y-0.5">
                        {lifecycle.pipelines[0].stages.map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[14px] font-mono py-0.5">
                            <span className="text-muted-foreground w-4">{i + 1}</span>
                            <span className="text-foreground/80">{s.stage}</span>
                            {s.output && <span className="text-muted-foreground ml-auto">→ {s.output}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* dependencies */}
                  {lifecycle.dependencies?.length > 0 && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <GitBranch className="size-3" /> Dependencies ({lifecycle.dependencies.length})
                      </SectionLabel>
                      <div className="space-y-0.5">
                        {lifecycle.dependencies.map((d: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[14px] px-1">
                            <span className="font-mono text-muted-foreground truncate flex-1">{d.dependsOn}</span>
                            <span className="text-muted-foreground">{d.versionRange}</span>
                            <span className={cn("rounded px-1 py-0.5 text-[8px]", d.required ? "bg-rose-500/10 text-rose-400" : "bg-foreground/5 text-muted-foreground")}>
                              {d.required ? "required" : "optional"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* data contract */}
                  {lifecycle.contract && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <FileCheck className="size-3" /> Data Contract
                      </SectionLabel>
                      <div className="rounded-lg border border-border bg-card/40 p-2.5 space-y-1.5">
                        <div>
                          <div className="text-[13px] text-muted-foreground mb-0.5">Consumes</div>
                          <div className="flex flex-wrap gap-0.5">
                            {lifecycle.contract.consumes.map((c: string, i: number) => (
                              <span key={i} className="rounded border border-border bg-foreground/5 px-1 py-0.5 text-[8px] font-mono text-muted-foreground">{c}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[13px] text-muted-foreground mb-0.5">Produces</div>
                          <div className="flex flex-wrap gap-0.5">
                            {lifecycle.contract.produces.map((p: string, i: number) => (
                              <span key={i} className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1 py-0.5 text-[8px] font-mono text-emerald-400">{p}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border">
                          {lifecycle.contract.validated ? (
                            <><CheckCircle2 className="size-3 text-emerald-400" /><span className="text-[13px] text-emerald-400">Contract validated</span></>
                          ) : (
                            <><XCircle className="size-3 text-rose-400" /><span className="text-[13px] text-rose-400">Validation errors</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* resource limits */}
                  {lifecycle.limits && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <Gauge className="size-3" /> Resource Limits
                      </SectionLabel>
                      <div className="grid grid-cols-2 gap-1 text-[14px]">
                        <div className="rounded border border-border bg-card/40 px-2 py-1">
                          <div className="text-muted-foreground">CPU</div>
                          <div className="font-mono">{lifecycle.limits.cpuMs}ms</div>
                        </div>
                        <div className="rounded border border-border bg-card/40 px-2 py-1">
                          <div className="text-muted-foreground">Memory</div>
                          <div className="font-mono">{lifecycle.limits.memoryMB}MB</div>
                        </div>
                        <div className="rounded border border-border bg-card/40 px-2 py-1">
                          <div className="text-muted-foreground">Raster reads</div>
                          <div className="font-mono">{lifecycle.limits.currentRasterReads}/{lifecycle.limits.maxRasterReads}</div>
                        </div>
                        <div className="rounded border border-border bg-card/40 px-2 py-1">
                          <div className="text-muted-foreground">API calls</div>
                          <div className="font-mono">{lifecycle.limits.currentApiCalls}/{lifecycle.limits.maxApiCalls}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* extended trust */}
                  {lifecycle.trust && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <Shield className="size-3" /> Trust Model
                      </SectionLabel>
                      <div className="rounded-lg border border-border bg-card/40 p-2.5 space-y-0.5 text-[14px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">Publisher</span><span>{lifecycle.trust.publisher}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reviewed by</span><span>{lifecycle.trust.reviewedBy ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Review status</span><span className={lifecycle.trust.reviewStatus === "approved" ? "text-emerald-400" : "text-amber-400"}>{lifecycle.trust.reviewStatus ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reproducibility</span><span className="font-mono">{lifecycle.trust.reproducibilityScore != null ? (lifecycle.trust.reproducibilityScore * 100).toFixed(0) + "%" : "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Scientific validation</span><span>{lifecycle.trust.scientificValidation ?? "—"}</span></div>
                        <div className="flex justify-between pt-1 border-t border-border"><span className="text-muted-foreground">Trust level</span><span className="font-semibold" style={{ color: lifecycle.trust.trustLevel === "official" ? "#34d399" : lifecycle.trust.trustLevel === "verified" ? "#fbbf24" : "#a1a1aa" }}>{lifecycle.trust.trustLevel}</span></div>
                      </div>
                    </div>
                  )}

                  {/* tests */}
                  {lifecycle.tests?.length > 0 && (
                    <div>
                      <SectionLabel className="mb-2 flex items-center gap-1.5">
                        <FlaskConical className="size-3" /> Extension Tests ({lifecycle.tests.length})
                      </SectionLabel>
                      <button
                        onClick={handleRunTests}
                        disabled={testing}
                        className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/15 disabled:opacity-50"
                      >
                        {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                        Run Tests
                      </button>
                      <div className="space-y-0.5">
                        {(testResults?.results || lifecycle.tests).map((t: any, i: number) => {
                          const result = testResults?.results?.[i]?.result || t.lastResult || "pending";
                          const color = result === "passed" ? "#34d399" : result === "failed" ? "#f43f5e" : "#71717a";
                          return (
                            <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card/30 px-2 py-1 text-[14px]">
                              <StatusDot color={color} />
                              <span className="font-mono text-muted-foreground flex-1 truncate">{t.testName}</span>
                              <span className="text-muted-foreground">{t.testType}</span>
                              <span style={{ color }}>{result}</span>
                            </div>
                          );
                        })}
                      </div>
                      {testResults && (
                        <div className="mt-2 rounded-md border border-border bg-card/40 p-2 text-center text-[14px]">
                          <span className="text-emerald-400 font-mono">{testResults.passed} passed</span>
                          <span className="text-muted-foreground mx-1">·</span>
                          <span className="text-rose-400 font-mono">{testResults.failed} failed</span>
                          <span className="text-muted-foreground mx-1">·</span>
                          <span className="font-mono">{testResults.total} total</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {lifecycleLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              )}

              {/* architecture explanation */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Puzzle className="size-4 text-primary" />
                  <span className="text-[15px] font-semibold text-primary">EXTENSION PLATFORM</span>
                </div>
                <p className="text-[16px] text-foreground/80 leading-relaxed">
                  The core platform is domain-agnostic. Domain expertise (mining, floods, agriculture)
                  lives in installable extensions with manifests, permissions, and a sandboxed SDK.
                  Extensions contribute rules, hypothesis types, mission types, and UI views.
                  The platform validates permissions and provides a limited API context (ctx).
                  Like VS Code extensions — the core evolves slowly, domain expertise evolves independently.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermRow({ icon: Icon, label, values, color }: { icon: React.ElementType; label: string; values: string[]; color: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3 mt-0.5" style={{ color }} />
      <div className="flex-1">
        <div className="text-[14px] text-muted-foreground mb-0.5">{label}</div>
        <div className="flex flex-wrap gap-0.5">
          {values.map((v) => (
            <span key={v} className="rounded border border-border bg-foreground/5 px-1 py-0.5 text-[13px] font-mono text-muted-foreground">
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
