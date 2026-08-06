"use client";

import { useEffect, useState, useCallback } from "react";
import { useGDT } from "@/lib/gdt/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Target,
  Award,
  AtSign,
  Loader2,
  CheckCheck,
  Circle,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Target,
  Award,
  AtSign,
  Bell,
};

interface Notif {
  id: string;
  notificationId: string;
  type: string;
  typeMeta: { color: string; icon: string; label: string };
  title: string;
  body: string;
  actionLabel?: string;
  actionView?: string;
  read: boolean;
  createdAtLabel: string;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function NotificationCenter() {
  const setView = useGDT((s) => s.setView);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Server resolves userId from the session cookie — no need to pass it client-side.
  const refreshCount = useCallback(async () => {
    try {
      const data = await api("/api/notifications?mode=count");
      setUnread(data.unread ?? 0);
    } catch {}
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/notifications?limit=20");
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Load list when popover opens
  useEffect(() => {
    if (open) refreshList();
  }, [open, refreshList]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = async (notif: Notif) => {
    // Mark as read
    if (!notif.read) {
      try {
        await api("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markRead", notificationId: notif.notificationId }),
        });
        setItems((prev) =>
          prev.map((n) =>
            n.notificationId === notif.notificationId ? { ...n, read: true } : n
          )
        );
        setUnread((u) => Math.max(0, u - 1));
      } catch {}
    }
    // Navigate if action view is set
    if (notif.actionView) {
      setView(notif.actionView as any);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-9">
            <Bell className="size-[18px]" />
          </Button>
        </PopoverTrigger>
        {unread > 0 && (
          <span
            className={cn(
              "pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex min-w-[16px] h-[16px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white px-1 ring-2 ring-background",
              unread > 9 && "px-0.5"
            )}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      <PopoverContent
        align="end"
        className="w-[380px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-[15px] font-semibold">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[12px] font-medium text-rose-500">
                {unread} new
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto gdt-scroll">
          {loading && items.length === 0 && (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex h-24 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Bell className="size-6 opacity-30" />
              <span className="text-[14px]">No notifications yet</span>
            </div>
          )}
          {items.map((n) => {
            const Icon = ICONS[n.typeMeta.icon] ?? Bell;
            const color = n.typeMeta.color;
            return (
              <button
                key={n.notificationId}
                onClick={() => handleItemClick(n)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/40",
                  !n.read && "bg-primary/5"
                )}
              >
                {/* Icon */}
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ color, background: `${color}15` }}
                >
                  <Icon className="size-4" />
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ color, background: `${color}15` }}
                    >
                      {n.typeMeta.label}
                    </span>
                    {!n.read && (
                      <Circle className="size-2 shrink-0 fill-rose-500 text-rose-500 mt-1" />
                    )}
                    <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
                      {n.createdAtLabel}
                    </span>
                  </div>
                  <p className="text-[14px] font-medium mt-1 line-clamp-2">{n.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  {n.actionLabel && (
                    <span className="text-[13px] font-medium text-primary mt-1 inline-block">
                      {n.actionLabel} →
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
