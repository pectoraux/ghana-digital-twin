"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/gdt/format";
import { Button } from "@/components/ui/button";
import { ProfileEditModal } from "@/components/gdt/ProfileEditModal";
import { useGDT } from "@/lib/gdt/store";
import {
  Loader2, MapPin, Shield, Award, Eye, CheckCircle2, Target,
  Package, Building2, Zap, TrendingUp, DollarSign, Brain,
  Pencil, FileText, MessageCircle, XCircle, HelpCircle, Activity,
} from "lucide-react";

async function api(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function ProfileView() {
  const { data: session } = useSession();
  const [identity, setIdentity] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const setView = useGDT((s) => s.setView);
  const setSelectedFeedItemId = useGDT((s) => s.setSelectedFeedItemId);

  const load = () => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;
    Promise.all([
      api(`/api/identity?userId=${userId}`),
      api(`/api/activity?userId=${userId}&limit=15`).catch(() => ({ activities: [] })),
    ]).then(([idRes, actRes]) => {
      setIdentity(idRes.identity);
      setActivities(actRes.activities || []);
    }).catch(() => setIdentity({})).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [session]);

  if (loading || !identity) return <div className="flex h-full items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const user = identity.user;
  const profile = identity.profile;
  const rep = identity.reputation;
  const org = identity.organization;

  return (
    <div className="h-full overflow-y-auto gdt-scroll">
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Identity Card */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card text-center relative">
          <Button
            onClick={() => setEditOpen(true)}
            size="sm"
            variant="outline"
            className="absolute top-3 right-3 flex items-center gap-1.5"
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
          <ProfileEditModal
            open={editOpen}
            onOpenChange={setEditOpen}
            initialProfile={profile}
            onSaved={load}
          />
          <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-primary/15 border-2 border-primary/30">
            <span className="text-[28px] font-bold text-primary">{(user?.name ?? "?").charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="text-[24px] font-bold">{profile?.displayName ?? user?.name}</h1>
          <p className="text-[15px] text-muted-foreground mt-1">{user?.role?.replace(/_/g, " ").toLowerCase()}</p>
          {org && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Building2 className="size-4 text-violet-500" />
              <span className="text-[14px] text-violet-500">{org.orgName}</span>
              <span className="text-[13px] text-muted-foreground">({org.role})</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <span className="text-[14px] text-muted-foreground">{profile?.region ?? "Unknown"}, {profile?.country ?? "Ghana"}</span>
          </div>
          {user?.isDemo && (
            <span className="mt-3 inline-block rounded-full bg-violet-500/15 px-3 py-1 text-[13px] font-medium text-violet-500">Demo Account</span>
          )}
        </div>

        {/* Reputation Scores */}
        {rep && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Reputation</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="text-center">
                <Shield className="size-6 mx-auto mb-2 text-teal-500" />
                <div className="text-[36px] font-bold font-mono text-teal-500">{rep.trustScore.toFixed(0)}</div>
                <div className="text-[14px] text-muted-foreground">Trust Score</div>
              </div>
              <div className="text-center">
                <Award className="size-6 mx-auto mb-2 text-amber-500" />
                <div className="text-[36px] font-bold font-mono text-amber-500">{rep.civicScore.toFixed(0)}</div>
                <div className="text-[14px] text-muted-foreground">Civic Score</div>
              </div>
              <div className="text-center">
                <Zap className="size-6 mx-auto mb-2 text-emerald-500" />
                <div className="text-[36px] font-bold font-mono text-emerald-500">{rep.contributionScore}</div>
                <div className="text-[14px] text-muted-foreground">Contribution</div>
              </div>
              <div className="text-center">
                <CheckCircle2 className="size-6 mx-auto mb-2 text-violet-500" />
                <div className="text-[14px] font-medium capitalize">{rep.verificationLevel}</div>
                <div className="text-[14px] text-muted-foreground">Verification</div>
              </div>
            </div>
          </div>
        )}

        {/* Impact Stats */}
        {rep && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card">
            <h2 className="text-[20px] font-semibold mb-4">Your Impact</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                <Eye className="size-5 text-amber-500 mb-2" />
                <div className="text-[24px] font-bold font-mono">{rep.totalReports}</div>
                <div className="text-[14px] text-muted-foreground">Reports Filed</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                <CheckCircle2 className="size-5 text-emerald-500 mb-2" />
                <div className="text-[24px] font-bold font-mono">{rep.totalVerified}</div>
                <div className="text-[14px] text-muted-foreground">Events Verified</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                <Package className="size-5 text-cyan-500 mb-2" />
                <div className="text-[24px] font-bold font-mono">{rep.totalAssets}</div>
                <div className="text-[14px] text-muted-foreground">Assets Published</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                <Target className="size-5 text-violet-500 mb-2" />
                <div className="text-[24px] font-bold font-mono">{rep.totalMissions}</div>
                <div className="text-[14px] text-muted-foreground">Missions Joined</div>
              </div>
            </div>
          </div>
        )}

        {/* About */}
        {profile?.bio && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card">
            <h2 className="text-[20px] font-semibold mb-3">About</h2>
            <p className="text-[15px] text-foreground/80 leading-relaxed">{profile.bio}</p>
            {profile.interests?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.interests.map((i: string) => (
                  <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-[13px] font-medium text-primary">{i.replace(/_/g, " ")}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skills */}
        {profile?.skills?.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card">
            <h2 className="text-[20px] font-semibold mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s: string) => (
                <span key={s} className="rounded-full bg-foreground/5 px-3 py-1 text-[13px] font-medium">{s.replace(/_/g, " ")}</span>
              ))}
            </div>
          </div>
        )}

        {/* My Activity Timeline */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card">
          <h2 className="text-[20px] font-semibold mb-4 flex items-center gap-2">
            <Activity className="size-5 text-primary" /> My Activity
          </h2>
          {activities.length === 0 ? (
            <p className="text-[14px] text-muted-foreground py-4 text-center">No activity yet. Start by reporting an event or joining a mission!</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto gdt-scroll">
              {activities.map((a) => {
              const IconMap: Record<string, React.ElementType> = {
                FileText, MessageCircle, Target, CheckCircle2, XCircle, HelpCircle,
              };
              const Icon = IconMap[a.icon] ?? Activity;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    if (a.kind === "report" || a.kind === "comment") {
                      setSelectedFeedItemId(a.actionId);
                    } else if (a.actionView) {
                      setView(a.actionView);
                    }
                  }}
                  className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 hover:bg-accent/30 transition-colors text-left"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color: a.color, background: `${a.color}15` }}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium" style={{ color: a.color }}>{a.action}</span>
                      <span className="ml-auto text-[12px] text-muted-foreground shrink-0">{a.timestampLabel}</span>
                    </div>
                    <p className="text-[14px] font-medium mt-0.5 truncate">{a.title}</p>
                    {a.subtitle && <p className="text-[13px] text-muted-foreground truncate">{a.subtitle}</p>}
                    {a.meta && <p className="text-[12px] text-muted-foreground mt-0.5">{a.meta}</p>}
                  </div>
                </button>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
