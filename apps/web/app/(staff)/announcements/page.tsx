"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { announcementSchema, type AnnouncementInput } from "@dorsu/shared-schemas";
import {
  BarChart3,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  Eraser,
  FileText,
  Image as ImageIcon,
  Megaphone,
  PenLine,
  Search,
  SearchX,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAnnouncementsBoard } from "@/lib/hooks/use-announcements-board";
import { useFocusRow } from "@/lib/hooks/use-focus-row";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import { Button, Card, Input } from "@/components/ui/primitives";
import { notifyStaff } from "@/lib/notify";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ReportDonut, ReportLines, ReportMultiLines } from "@/components/shared/reports-charts";
import { AnnouncementCard, statusOf, type Announcement } from "@/components/announcements/AnnouncementCard";
import { AnnouncementForm, type AudienceValue } from "@/components/announcements/AnnouncementForm";
import { imageValidationError, uploadAnnouncementImage } from "@/components/announcements/image-upload";

const EMPTY_ROWS: Announcement[] = [];
const EMPTY_AUTHORS = new Map<string, string>();

type FeedFilter = "all" | "published" | "draft" | "scheduled" | "images" | "week";

/**
 * Head-only announcements — a newsfeed (composer + filterable posts) plus an
 * insights tab. Other staff get the same feed chrome, read-only and scoped to
 * posts aimed at them.
 */
export default function AnnouncementsPage() {
  const { data: board, isLoading, isError, refetch } = useAnnouncementsBoard();
  const rows = board?.rows ?? EMPTY_ROWS;
  const authors = board?.authors ?? EMPTY_AUTHORS;
  const myName = board?.myName ?? "Guidance";
  const role = board?.role ?? null;
  const loading = isLoading && !board;
  // Visiting the section clears its sidebar badge (badges count unread
  // notification rows, not page views).
  useClearSectionBadge("/announcements", !loading && !!board);
  const [audience, setAudience] = useState<AudienceValue[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "publish">(null);
  const { busyId, run: runMutation } = useMutationAction();
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState("feed");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState, reset } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
  });

  useEffect(() => {
    if (isError) toast.error("Couldn't load announcements right now.");
  }, [isError]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const now = Date.now();

  // Publishing is head-only (rbac + RLS). Other staff get a read-only feed
  // of published posts aimed at them (or everyone). Drafts never reach them
  // — RLS already excludes drafts, this also drops other roles' targeting.
  const isHead = role === "guidance_head";
  const audienceKey = role === "faculty" ? "faculty" : "counselor";
  const visibleRows = isHead
    ? rows
    : rows.filter(
        (a) =>
          statusOf(a, now) === "published" &&
          (!a.audience || !a.audience.length || a.audience.includes(audienceKey))
      );
  const focusedId = useFocusRow(visibleRows);

  const stats = useMemo(() => {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const by = (fn: (a: Announcement) => boolean) => rows.filter(fn).length;
    const byAuthor = new Map<string, number>();
    for (const a of rows) byAuthor.set(a.author_profile_id, (byAuthor.get(a.author_profile_id) ?? 0) + 1);
    return {
      total: rows.length,
      published: by((a) => statusOf(a, now) === "published"),
      drafts: by((a) => statusOf(a, now) === "draft"),
      scheduled: by((a) => statusOf(a, now) === "scheduled"),
      withImages: by((a) => !!a.image_url),
      thisWeek: by((a) => new Date(a.created_at).getTime() >= weekAgo),
      topAuthors: [...byAuthor.entries()]
        .map(([id, n]) => ({ name: authors.get(id) ?? "Staff", count: n }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, authors]);

  const counts = useMemo(() => {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return {
      all: visibleRows.length,
      published: visibleRows.filter((a) => statusOf(a, now) === "published").length,
      draft: visibleRows.filter((a) => statusOf(a, now) === "draft").length,
      scheduled: visibleRows.filter((a) => statusOf(a, now) === "scheduled").length,
      images: visibleRows.filter((a) => !!a.image_url).length,
      week: visibleRows.filter((a) => new Date(a.created_at).getTime() >= weekAgo).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows]);

  const feedRows = useMemo(() => {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const q = query.trim().toLowerCase();
    return visibleRows.filter((a) => {
      if (feedFilter === "published" && statusOf(a, now) !== "published") return false;
      if (feedFilter === "draft" && statusOf(a, now) !== "draft") return false;
      if (feedFilter === "scheduled" && statusOf(a, now) !== "scheduled") return false;
      if (feedFilter === "images" && !a.image_url) return false;
      if (feedFilter === "week" && new Date(a.created_at).getTime() < weekAgo) return false;
      if (!q) return true;
      const author = authors.get(a.author_profile_id) ?? "";
      return `${a.title} ${a.body} ${author}`.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, feedFilter, query, authors]);

  const activity = useMemo(() => {
    const start = new Date(now - 13 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        key: d.toDateString(),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: 0,
      };
    });
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const a of rows) {
      const b = byKey.get(new Date(a.created_at).toDateString());
      if (b) b.value += 1;
    }
    return buckets.map(({ label, value }) => ({ label, value }));
  }, [rows, now]);

  // Same 14-day buckets, split by status — the feed's full-width rhythm
  // chart draws one line per status so publishing behaviour is visible, not
  // just the total.
  const activityByStatus = useMemo(() => {
    const start = new Date(now - 13 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        key: d.toDateString(),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        published: 0,
        draft: 0,
        scheduled: 0,
      };
    });
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const a of visibleRows) {
      const b = byKey.get(new Date(a.created_at).toDateString());
      if (b) b[statusOf(a, now)] += 1;
    }
    return buckets.map(({ label, published, draft, scheduled }) => ({ label, published, draft, scheduled }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows]);

  const statusSeries = isHead
    ? [
        { key: "published", label: "Published", color: "#22C55E" },
        { key: "draft", label: "Drafts", color: "#F59E0B" },
        { key: "scheduled", label: "Scheduled", color: "#8B5CF6" },
      ]
    : [{ key: "published", label: "Published", color: "#22C55E" }];

  const audienceMix = useMemo(() => {
    const defs = [
      { name: "Everyone", color: "#2563EB", match: (a: Announcement) => !a.audience || !a.audience.length },
      { name: "Students", color: "#22C55E", match: (a: Announcement) => !!a.audience?.includes("student") },
      { name: "Counselors", color: "#F59E0B", match: (a: Announcement) => !!a.audience?.includes("counselor") },
      { name: "Faculty", color: "#8B5CF6", match: (a: Announcement) => !!a.audience?.includes("faculty") },
    ];
    return defs
      .map((d) => ({ name: d.name, color: d.color, value: rows.filter(d.match).length }))
      .filter((s) => s.value > 0);
  }, [rows]);

  const toggleAudience = (v: AudienceValue) =>
    setAudience((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const pickImage = (f: File | undefined) => {
    if (!f) return;
    const err = imageValidationError(f);
    if (err) {
      toast.error(err);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string> => {
    return uploadAnnouncementImage(createClient(), file);
  };

  const save = (publish: boolean) =>
    handleSubmit(async (v) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You're signed out — please log in again.");
        return;
      }
      setSaving(publish ? "publish" : "draft");
      try {
        const image_url = imageFile ? await uploadImage(imageFile) : null;
        const { data: created, error } = await supabase.from("announcements").insert({
          author_profile_id: user.id,
          title: v.title,
          body: v.body,
          audience: audience.length ? audience : null,
          image_url,
          published_at: publish ? new Date().toISOString() : null,
        }).select("id").single();
        if (error) throw error;
        reset();
        setAudience([]);
        clearImage();
        await refetch();
        if (publish) {
          let q = supabase.from("profiles").select("id").eq("is_active", true);
          if (audience.length) q = q.in("role", audience);
          const { data: targets } = await q.limit(500);
          // Fire-and-forget: publish success reflects the DB write, not delivery.
          void notifyStaff(((targets ?? []) as { id: string }[]).map((t) => t.id), {
            type: "announcement",
            title: v.title,
            body: v.body.length > 180 ? `${v.body.slice(0, 180)}…` : v.body,
            link: ((created as { id?: string } | null)?.id)
              ? `/announcements#focus-${(created as { id: string }).id}`
              : "/announcements",
            ...(((created as { id?: string } | null)?.id)
              ? { dedupeKey: `announcement:${(created as { id: string }).id}:published` }
              : {}),
            tone: "info",
          });
          toast.success("Published to the newsfeed.");
        } else {
          toast.success("Saved as a draft.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save — please try again.");
      } finally {
        setSaving(null);
      }
    });

  const setPublished = async (a: Announcement, at: string | null, tag: string) => {
    const result = await runMutation(
      tag,
      async () => {
        const { error } = await createClient().from("announcements").update({ published_at: at }).eq("id", a.id);
        if (error) throw error;
      },
      { label: "update that post" }
    );
    if (!result.ok) return;
    await refetch();
    if (at) {
      // Toggling a draft live notifies the same role-filtered audience as a
      // fresh publish — fire-and-forget, success reflects the DB write.
      try {
        const supabase = createClient();
        let q = supabase.from("profiles").select("id").eq("is_active", true);
        if (a.audience?.length) q = q.in("role", a.audience as AudienceValue[]);
        const { data: targets } = await q.limit(500);
        void notifyStaff(((targets ?? []) as { id: string }[]).map((t) => t.id), {
          type: "announcement",
          title: a.title,
          body: a.body.length > 180 ? `${a.body.slice(0, 180)}…` : a.body,
          link: `/announcements#focus-${a.id}`,
          dedupeKey: `announcement:${a.id}:published`,
          tone: "info",
        });
      } catch {
        // Audience lookup failed — the post is still published; skip the ping.
      }
      toast.success("Post published.");
    } else {
      toast.success("Post unpublished.");
    }
  };

  const removePost = async (a: Announcement) => {
    if (deleting) return;
    setDeleting(true);
    const result = await runMutation(
      a.id,
      async () => {
        const { error } = await createClient().from("announcements").delete().eq("id", a.id);
        if (error) throw error;
        if (a.image_url?.includes("/announcement-images/")) {
          const path = a.image_url.split("/announcement-images/")[1];
          if (path) {
            await createClient().storage.from("announcement-images").remove([path]).catch(() => {});
          }
        }
      },
      { label: "delete that post" }
    );
    setDeleting(false);
    if (!result.ok) return;
    setConfirmDelete(null);
    await refetch();
    toast.success("Post deleted.");
  };

  const filtersActive = feedFilter !== "all" || query.trim() !== "";

  const pickFilter = (f: FeedFilter) => {
    setTab("feed");
    setFeedFilter(f);
  };

  const clearFilters = () => {
    setFeedFilter("all");
    setQuery("");
  };

  const writeUpdate = () => {
    setTab("feed");
    window.setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // One clear "what next" shortcut: drafts are the only thing a head can
  // usefully act on from here.
  const focusNudge =
    isHead && stats.drafts > 0
      ? {
          label: `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"} waiting to go live`,
          cta: "Review drafts",
          pick: () => pickFilter("draft"),
        }
      : isHead && stats.total === 0
        ? { label: "The newsfeed is empty — write the first update", cta: "Write update", pick: writeUpdate }
        : !isHead && counts.all > 0
          ? { label: `${counts.all} update${counts.all === 1 ? "" : "s"} for you from the office`, cta: "Read feed", pick: () => pickFilter("all") }
          : null;

  const allStatCards: { key: FeedFilter; label: string; value: number; hint: string; icon: typeof FileText }[] = [
    { key: "all", label: isHead ? "All posts" : "Your feed", value: counts.all, hint: "Everything filed", icon: FileText },
    { key: "published", label: "Published", value: counts.published, hint: "Live now", icon: CheckCheck },
    { key: "draft", label: "Drafts", value: counts.draft, hint: "Not live yet", icon: PenLine },
    { key: "images", label: "With photo", value: counts.images, hint: "Visual posts", icon: ImageIcon },
    { key: "week", label: "This week", value: counts.week, hint: "Last 7 days", icon: TrendingUp },
  ];
  // Drafts are head-only, so the read-only feed never advertises an empty tab.
  const statCards = isHead ? allStatCards : allStatCards.filter((s) => s.key !== "draft");

  const filterChips: { key: FeedFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    ...(isHead
      ? [
          { key: "published" as const, label: "Published", count: counts.published },
          { key: "draft" as const, label: "Drafts", count: counts.draft },
          { key: "scheduled" as const, label: "Scheduled", count: counts.scheduled },
        ]
      : []),
    { key: "images", label: "With photo", count: counts.images },
    { key: "week", label: "This week", count: counts.week },
  ];

  return (
    <div className="w-full space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-200/30 blur-2xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Guidance office
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                  {isHead ? "Announcements" : "News for you"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-primary-700">
                  <Users className="h-3 w-3" aria-hidden />
                  {isHead ? "Guidance head" : role === "faculty" ? "Faculty view" : "Staff view"}
                </span>
              </div>
              <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">
                {isHead
                  ? "The office newsfeed — post updates with photos, publish drafts, and check how posting is doing."
                  : "Updates from the guidance office — news meant for you."}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isHead && (
                <div className="flex items-center gap-1 rounded-lg border border-ink/10 bg-white p-1" role="group" aria-label="Switch view">
                  {[
                    { value: "feed", label: "Newsfeed", icon: Megaphone },
                    { value: "insights", label: "Insights", icon: BarChart3 },
                  ].map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      aria-pressed={tab === v.value}
                      onClick={() => setTab(v.value)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                        tab === v.value
                          ? "bg-primary-600 text-white shadow-sm"
                          : "text-ink-soft hover:bg-cream"
                      )}
                    >
                      <v.icon className="h-3.5 w-3.5" aria-hidden />
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
              {isHead && (
                <Button size="sm" onClick={writeUpdate} className="gap-1.5">
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  Write update
                </Button>
              )}
            </div>
          </div>

          {/* Next-step nudge (dismisses itself when nothing is waiting). */}
          {!loading && focusNudge && (
            <div className="relative mt-4 flex flex-col gap-2.5 rounded-xl border border-accent-300 bg-accent-50/80 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-700">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
                <p className="text-[12.5px] font-semibold text-ink">{focusNudge.label}</p>
              </div>
              <button
                type="button"
                onClick={focusNudge.pick}
                className="inline-flex h-6 shrink-0 items-center gap-1 self-start rounded-full bg-accent-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:self-auto"
              >
                {focusNudge.cta}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}

          {/* Clickable stat cards — each applies its feed filter. */}
          <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            {statCards.map((s) => {
              const active = tab === "feed" && feedFilter === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => pickFilter(s.key)}
                  title={`Show ${s.label} in the feed`}
                  aria-pressed={active}
                  className={cn(
                    "group rounded-xl border p-3 text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    active
                      ? "border-primary-400 bg-primary-600 text-white ring-1 ring-primary-300"
                      : "border-white/70 bg-white/75 backdrop-blur hover:border-primary-300 hover:bg-white"
                  )}
                >
                  <span className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]", active ? "text-primary-100" : "text-ink-muted")}>
                    <s.icon className={cn("h-3 w-3", active ? "text-white" : "text-primary-600")} aria-hidden />
                    {s.label}
                  </span>
                  {loading ? (
                    <span className={cn("mt-2 block h-7 w-10 animate-pulse rounded", active ? "bg-white/30" : "bg-ink/10")} aria-hidden />
                  ) : (
                    <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums">{s.value}</span>
                  )}
                  <span className={cn("mt-1 block truncate text-[10.5px]", active ? "text-primary-100" : "text-ink-faint")}>{s.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Newsfeed ── */}
        <TabsContent value="feed">
          <div className="space-y-4">
            {/* Full-width publishing rhythm — one line per status. */}
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                    <TrendingUp className="h-4 w-4 text-primary-600" aria-hidden />
                    Publishing rhythm
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    Posts per day by status — last 14 days.
                  </p>
                </div>
                <ul className="flex flex-wrap items-center gap-3" aria-label="Chart legend">
                  {statusSeries.map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-muted">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </li>
                  ))}
                </ul>
              </div>
              {loading ? (
                <div className="mt-4 h-[220px] animate-pulse rounded-lg bg-ink/10" aria-hidden />
              ) : rows.length ? (
                <ReportMultiLines data={activityByStatus} series={statusSeries} height={220} />
              ) : (
                <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0 space-y-4">
              {/* Filter bar */}
              <Card className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
                    <Input
                      placeholder="Search posts…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search announcements by title, body, or author"
                      className="h-8 pl-8"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-white p-1" role="group" aria-label="Filter by status">
                    {filterChips.map((f) => {
                      const active = feedFilter === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setFeedFilter(f.key)}
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                            active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-cream"
                          )}
                        >
                          {f.label}
                          <span className={active ? "text-primary-100" : "text-ink-faint"}>{f.count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 text-[11.5px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      <Eraser className="h-3.5 w-3.5" aria-hidden />
                      Clear
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11.5px] font-medium text-ink-faint">
                  {loading
                    ? "Loading the newsfeed…"
                    : `Showing ${feedRows.length} of ${counts.all} post${counts.all === 1 ? "" : "s"}${
                        query.trim() ? " · search matches loaded posts" : ""
                      }`}
                </p>
              </Card>

              {/* Composer (head only — publishing is head-only per rbac + RLS) */}
              {isHead && (
                <div ref={composerRef} className="scroll-mt-24">
                  <AnnouncementForm
                    myName={myName}
                    register={register}
                    errors={formState.errors}
                    audience={audience}
                    onToggleAudience={toggleAudience}
                    imagePreview={imagePreview}
                    fileRef={fileRef}
                    onPickFile={pickImage}
                    onClearImage={clearImage}
                    onSubmit={save(true)}
                    onSaveDraft={() => void save(false)()}
                    saving={saving}
                  />
                </div>
              )}

              {/* Feed */}
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-ink/10 bg-white p-5 shadow-card" aria-hidden>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-ink/10" />
                      <div className="flex-1">
                        <div className="h-3.5 w-1/3 rounded-full bg-ink/10" />
                        <div className="mt-1.5 h-3 w-1/4 rounded-full bg-ink/10" />
                      </div>
                    </div>
                    <div className="mt-3 h-4 w-2/3 rounded-full bg-ink/10" />
                    <div className="mt-2 h-16 rounded-lg bg-ink/10" />
                  </div>
                ))}

              {!loading &&
                feedRows.map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    a={a}
                    now={now}
                    authorName={authors.get(a.author_profile_id) ?? "Staff"}
                    isHead={isHead}
                    busyId={busyId}
                    focused={focusedId === a.id}
                    onPublish={(x) => void setPublished(x, new Date().toISOString(), `pub-${x.id}`)}
                    onUnpublish={(x) => void setPublished(x, null, `unpub-${x.id}`)}
                    onDelete={(x) => setConfirmDelete(x)}
                  />
                ))}

              {!loading && !feedRows.length && (
                <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-primary-600 ring-1 ring-blue-100">
                    <SearchX className="h-6 w-6" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-bold text-ink">
                    {filtersActive ? "No posts match these filters" : "Nothing posted yet"}
                  </p>
                  <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
                    {filtersActive
                      ? "Try clearing the search or choosing another status — nothing is hidden permanently."
                      : isHead
                        ? "Write the first update above — it appears here the moment you post."
                        : "No announcements for you yet. New office updates land here."}
                  </p>
                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 text-[12px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      <Eraser className="h-3.5 w-3.5" aria-hidden />
                      Clear filters
                    </button>
                  ) : (
                    isHead && (
                      <Button size="sm" onClick={writeUpdate} className="mt-4 gap-1.5">
                        <PenLine className="h-3.5 w-3.5" aria-hidden />
                        Write the first update
                      </Button>
                    )
                  )}
                </Card>
              )}
            </div>

            {/* Right rail — status split, authors, and a privacy reminder. */}
            <aside className="space-y-4 lg:sticky lg:top-4">
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                  <BarChart3 className="h-4 w-4 text-primary-600" aria-hidden />
                  Feed status
                </h2>
                <p className="mt-0.5 text-[11.5px] font-medium text-ink-muted">Where this feed&apos;s posts stand.</p>
                <ul className="mt-3 space-y-3">
                  {[
                    { label: "Published", value: counts.published, color: "#22C55E" },
                    ...(isHead
                      ? [
                          { label: "Drafts", value: counts.draft, color: "#F59E0B" },
                          { label: "Scheduled", value: counts.scheduled, color: "#8B5CF6" },
                        ]
                      : []),
                  ].map((s) => {
                    const pct = counts.all ? Math.round((s.value / counts.all) * 100) : 0;
                    return (
                      <li key={s.label}>
                        <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold">
                          <span className="flex items-center gap-1.5 text-ink-soft">
                            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </span>
                          <span className="tabular-nums text-ink-faint">
                            {loading ? "—" : `${s.value} · ${pct}%`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/10" aria-hidden>
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${pct}%`, backgroundColor: s.color }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                  <Users className="h-4 w-4 text-primary-600" aria-hidden />
                  Top authors
                </h2>
                {loading ? (
                  <div className="mt-3 space-y-2 animate-pulse" aria-hidden>
                    <div className="h-8 rounded-lg bg-ink/10" />
                    <div className="h-8 rounded-lg bg-ink/10" />
                    <div className="h-8 rounded-lg bg-ink/10" />
                  </div>
                ) : stats.topAuthors.length ? (
                  <ul className="mt-2 divide-y divide-ink/10">
                    {stats.topAuthors.map((a, i) => (
                      <li key={a.name} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                        <p className="min-w-0 truncate text-[12.5px] font-bold text-ink">
                          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[10px] font-bold text-ink-muted">
                            {i + 1}
                          </span>
                          {a.name}
                        </p>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-bold text-blue-800">
                          {a.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg bg-cream px-3 py-2.5 text-[12px] text-ink-muted">No authors yet.</p>
                )}
              </Card>

              <Card className="border-primary-100 bg-blue-50/40 p-5">
                <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                  <FileText className="h-4 w-4 text-primary-600" aria-hidden />
                  Posting reminders
                </h2>
                <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  <li>· Never put student names, case details, or session notes in a post.</li>
                  <li>· Drafts are invisible to staff until you publish them.</li>
                  <li>· No audience ticked means every active staff member is notified.</li>
                </ul>
              </Card>
            </aside>
            </div>
          </div>
        </TabsContent>

        {/* ── Insights ── */}
        <TabsContent value="insights">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Total posts", value: stats.total, icon: FileText },
                { label: "Published", value: stats.published, icon: CheckCheck },
                { label: "Drafts", value: stats.drafts, icon: PenLine },
                { label: "Scheduled", value: stats.scheduled, icon: CalendarClock },
                { label: "This week", value: stats.thisWeek, icon: TrendingUp },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-ink/10 bg-white p-3 shadow-card">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    <s.icon className="h-3 w-3 text-primary-600" aria-hidden />
                    {s.label}
                  </span>
                  {loading ? (
                    <span className="mt-2 block h-7 w-10 animate-pulse rounded bg-ink/10" aria-hidden />
                  ) : (
                    <span className="mt-1 block font-display text-xl font-bold leading-none tabular-nums text-ink">{s.value}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                      <TrendingUp className="h-4 w-4 text-primary-600" aria-hidden />
                      Posts — last 14 days
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">Publishing rhythm, drafts included.</p>
                  </div>
                </div>
                {loading ? (
                  <div className="animate-pulse pt-4" aria-hidden>
                    <div className="h-[240px] rounded-lg bg-ink/10" />
                  </div>
                ) : rows.length ? (
                  <ReportLines data={activity} />
                ) : (
                  <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Users className="h-4 w-4 text-primary-600" aria-hidden />
                  Audience mix
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">Who posts are aimed at — a post can tag several groups.</p>
                {loading ? (
                  <div className="animate-pulse pt-4" aria-hidden>
                    <div className="h-[200px] rounded-lg bg-ink/10" />
                  </div>
                ) : audienceMix.length ? (
                  <ReportDonut data={audienceMix} />
                ) : (
                  <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
                )}
              </Card>
            </div>

            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                <Sparkles className="h-4 w-4 text-primary-600" aria-hidden />
                Top authors
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">Who keeps the newsfeed alive.</p>
              {loading ? (
                <div className="animate-pulse space-y-3 pt-3" aria-hidden>
                  <div className="h-10 rounded-lg bg-ink/10" />
                  <div className="h-10 rounded-lg bg-ink/10" />
                </div>
              ) : stats.topAuthors.length ? (
                <ul className="mt-3 divide-y divide-ink/10">
                  {stats.topAuthors.map((a, i) => (
                    <li key={a.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-bold text-ink">
                        <span className="mr-2 text-xs font-bold text-ink-faint">#{i + 1}</span>
                        {a.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                        {a.count} post{a.count === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No authors yet.</p>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ann-del-title"
          aria-describedby="ann-del-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="ann-del-title" className="font-display text-lg font-bold text-ink">Delete this post?</h2>
                <p id="ann-del-desc" className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                  “{confirmDelete.title}” disappears for everyone, photo included. This can&apos;t be undone — unpublish instead to hide it temporarily.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                aria-label="Close"
                className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={deleting} onClick={() => setConfirmDelete(null)} autoFocus>
                Back
              </Button>
              <Button size="sm" variant="danger" loading={deleting} onClick={() => void removePost(confirmDelete)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
