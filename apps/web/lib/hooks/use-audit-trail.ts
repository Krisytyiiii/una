"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Full, head-only audit-trail reader.
 *
 * Unlike the security console preview (latest 100 rows), this pages through
 * the entire append-only `audit_logs` table and resolves the actor behind
 * each row so the trail answers "who did what, and when".
 */

export type AuditTrailRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/** Window presets surfaced as segmented controls on the trail page. */
export type AuditTrailRange = "all" | "24h" | "7d" | "30d";

/** Newest-first is the ledger default; oldest-first helps reconstruct events. */
export type AuditTrailOrder = "newest" | "oldest";

export type AuditDayBucket = {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  count: number;
};

export type AuditTrailData = {
  rows: AuditTrailRow[];
  actors: Map<string, AuditActor>;
  /** Distinct actions/entities seen in the recent window, for the filters. */
  actions: string[];
  entities: string[];
  /** Rows matching the active filters. */
  total: number;
  /** Rows in the whole table (unfiltered). */
  totalAll: number;
  today: number;
  /** Daily event volume for the last 14 days — powers the hero sparkline. */
  daily: AuditDayBucket[];
};

export type AuditTrailFilters = {
  page: number;
  entity: string;
  action: string;
  query: string;
  range: AuditTrailRange;
  order: AuditTrailOrder;
};

export const AUDIT_TRAIL_PAGE_SIZE = 25;

const FACET_ROWS = 1000;
const DAILY_DAYS = 14;
const DAILY_ROW_CAP = 2000;

/** PostgREST `or` strings treat these as syntax — keep them out of user input. */
function sanitizeQuery(input: string): string {
  return input.trim().replace(/[(),]/g, " ").replace(/\s+/g, " ");
}

/** Local `YYYY-MM-DD` key so day buckets line up with the viewer's clock. */
function localDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeStart(range: AuditTrailRange): Date | null {
  if (range === "all") return null;
  const d = new Date();
  if (range === "24h") d.setHours(d.getHours() - 24);
  if (range === "7d") d.setDate(d.getDate() - 7);
  if (range === "30d") d.setDate(d.getDate() - 30);
  return d;
}

export async function fetchAuditTrail(filters: AuditTrailFilters): Promise<AuditTrailData> {
  const supabase = createClient();
  const q = sanitizeQuery(filters.query);

  // Search can also match the actor's name/email, which lives on `profiles`.
  let actorMatches: string[] = [];
  if (q) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(50);
    actorMatches = ((data ?? []) as { id: string }[]).map((p) => p.id);
  }

  const from = Math.max(0, (filters.page - 1) * AUDIT_TRAIL_PAGE_SIZE);
  const since = rangeStart(filters.range);
  const ascending = filters.order === "oldest";

  let listQuery = supabase
    .from("audit_logs")
    .select("id, actor_profile_id, action, entity, entity_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending });

  if (since) listQuery = listQuery.gte("created_at", since.toISOString());
  if (filters.entity !== "all") listQuery = listQuery.eq("entity", filters.entity);
  if (filters.action !== "all") listQuery = listQuery.eq("action", filters.action);
  if (q) {
    const clauses = [`action.ilike.%${q}%`, `entity.ilike.%${q}%`];
    if (actorMatches.length) clauses.push(`actor_profile_id.in.(${actorMatches.join(",")})`);
    listQuery = listQuery.or(clauses.join(","));
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const dailyStart = new Date();
  dailyStart.setHours(0, 0, 0, 0);
  dailyStart.setDate(dailyStart.getDate() - (DAILY_DAYS - 1));

  const [listRes, totalRes, todayRes, facetRes, dailyRes] = await Promise.all([
    listQuery.range(from, from + AUDIT_TRAIL_PAGE_SIZE - 1),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString()),
    supabase
      .from("audit_logs")
      .select("action, entity")
      .order("created_at", { ascending: false })
      .limit(FACET_ROWS),
    supabase
      .from("audit_logs")
      .select("created_at")
      .gte("created_at", dailyStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(DAILY_ROW_CAP),
  ]);

  if (listRes.error) throw listRes.error;

  const rows = (listRes.data ?? []) as AuditTrailRow[];
  const actorIds = [...new Set(rows.map((r) => r.actor_profile_id).filter((id): id is string => !!id))];
  const { data: actorRows } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", actorIds.slice(0, 200))
    : { data: [] as { id: string; full_name: string | null; email: string; role: string }[] };

  const actors = new Map<string, AuditActor>(
    ((actorRows ?? []) as { id: string; full_name: string | null; email: string; role: string }[]).map((p) => [
      p.id,
      { id: p.id, name: p.full_name ?? p.email, email: p.email, role: p.role },
    ])
  );

  const facets = (facetRes.data ?? []) as { action: string; entity: string }[];

  // Build complete 14-day buckets (zero-filled) so the sparkline has no gaps.
  const counts = new Map<string, number>();
  for (const row of (dailyRes.data ?? []) as { created_at: string }[]) {
    const key = localDayKey(new Date(row.created_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const daily: AuditDayBucket[] = [];
  for (let i = 0; i < DAILY_DAYS; i++) {
    const d = new Date(dailyStart);
    d.setDate(dailyStart.getDate() + i);
    const key = localDayKey(d);
    daily.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return {
    rows,
    actors,
    actions: [...new Set(facets.map((f) => f.action))].sort(),
    entities: [...new Set(facets.map((f) => f.entity))].sort(),
    total: listRes.count ?? rows.length,
    totalAll: totalRes.count ?? 0,
    today: todayRes.count ?? 0,
    daily,
  };
}

/**
 * Cached audit pager — filter/page changes keep the previous page visible
 * (keepPreviousData) so the table never flashes empty between clicks.
 */
export function useAuditTrail(filters: AuditTrailFilters) {
  return useQuery({
    queryKey: ["security", "audit-trail", filters],
    queryFn: () => fetchAuditTrail(filters),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
