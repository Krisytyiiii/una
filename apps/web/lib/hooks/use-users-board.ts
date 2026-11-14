"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UserRole } from "@dorsu/shared-types";
import { createClient } from "@/lib/supabase/client";
import { MAX_PAGE_SIZE } from "@/lib/pagination";

export type UsersProfile = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type UsersStats = {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  staff: number;
  newWeek: number;
  byRole: Map<string, number>;
};

export type UsersBoardData = {
  me: string | null;
  rows: UsersProfile[];
  details: Map<string, string>;
  page: number;
  size: number;
  /** Exact count of accounts matching the current role/status/search scope. */
  total: number;
  hasMore: boolean;
  stats: UsersStats;
};

export type UsersScope = {
  page: number;
  size: number;
  /** "all" | "staff" | student | counselor | guidance_head | faculty */
  role: string;
  /** "all" | "active" | "pending" | "inactive" */
  status: string;
  query: string;
};

export const USERS_BOARD_KEY = ["users", "board"] as const;

/** Fresh window — inside it, going back to /users renders zero-fetch. */
export const USERS_BOARD_STALE_MS = 60_000;

export const DEFAULT_USERS_SCOPE: UsersScope = {
  page: 1,
  size: 10,
  role: "all",
  status: "all",
  query: "",
};

const EMPTY_DETAILS = new Map<string, string>();
const EMPTY_STATS: UsersStats = {
  total: 0,
  active: 0,
  inactive: 0,
  pending: 0,
  staff: 0,
  newWeek: 0,
  byRole: new Map(),
};

/** PostgREST `or=` syntax treats these as separators/wildcards. */
function sanitizeSearch(term: string): string {
  return term.replace(/[",()%*\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Page-scoped users directory.
 *
 * Stats/tabs still come from a full summary read (cheap columns, one query),
 * while the table itself is fetched with `.range()` and exact filtering —
 * so paging, role/status filters, and search all hit the server. React Query
 * keeps the previous page visible while the next one loads
 * (`isPlaceholderData`), which drives the table skeleton.
 */
export async function fetchUsersBoard(scope: UsersScope = DEFAULT_USERS_SCOPE): Promise<UsersBoardData> {
  const page = Math.max(1, Math.floor(scope.page) || 1);
  const size = Math.min(Math.max(Math.floor(scope.size) || 10, 1), MAX_PAGE_SIZE);
  const role = scope.role || "all";
  const status = scope.status || "all";
  const term = sanitizeSearch(scope.query || "");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");

  // Summary for the stat cards + tab counts. Only the columns the header
  // needs, so this stays cheap even when paging repeatedly.
  const summaryPromise = supabase
    .from("profiles")
    .select("role, is_active, approval_status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  let listQuery = supabase
    .from("profiles")
    .select("id, email, role, full_name, is_active, approval_status, created_at", {
      count: "exact",
    });

  if (role === "staff") listQuery = listQuery.neq("role", "student");
  else if (role !== "all") listQuery = listQuery.eq("role", role as UserRole);

  if (status === "active") {
    listQuery = listQuery.eq("is_active", true).neq("approval_status", "pending");
  } else if (status === "pending") {
    listQuery = listQuery.eq("approval_status", "pending");
  } else if (status === "inactive") {
    listQuery = listQuery.eq("is_active", false).neq("approval_status", "pending");
  }

  if (term) {
    listQuery = listQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const from = (page - 1) * size;
  const listPromise = listQuery
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);

  const [summaryRes, listRes] = await Promise.all([summaryPromise, listPromise]);
  if (summaryRes.error) throw summaryRes.error;
  if (listRes.error) throw listRes.error;

  const summary = (summaryRes.data ?? []) as {
    role: string;
    is_active: boolean;
    approval_status: string;
    created_at: string;
  }[];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const byRole = new Map<string, number>();
  for (const u of summary) byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1);
  const stats: UsersStats = {
    ...EMPTY_STATS,
    total: summary.length,
    active: summary.filter((u) => u.is_active && u.approval_status !== "pending").length,
    inactive: summary.filter((u) => !u.is_active && u.approval_status !== "pending").length,
    pending: summary.filter((u) => u.approval_status === "pending").length,
    staff: summary.filter((u) => u.role !== "student").length,
    newWeek: summary.filter((u) => new Date(u.created_at).getTime() >= weekAgo).length,
    byRole,
  };

  const rows = ((listRes.data ?? []) as UsersProfile[]);
  const total = listRes.count ?? rows.length;

  // Detail column — only for the visible page.
  const ids = rows.map((u) => u.id);
  let details = EMPTY_DETAILS;
  if (ids.length) {
    const [counselors, students, faculty] = await Promise.all([
      supabase.from("counselors").select("profile_id, specialization").in("profile_id", ids),
      supabase.from("students").select("profile_id, program, year_level").in("profile_id", ids),
      supabase.from("faculty_members").select("profile_id, department").in("profile_id", ids),
    ]);
    details = new Map<string, string>();
    for (const c of ((counselors.data ?? []) as { profile_id: string; specialization: string | null }[])) {
      if (c.specialization) details.set(c.profile_id, c.specialization);
    }
    for (const s of ((students.data ?? []) as {
      profile_id: string;
      program: string | null;
      year_level: string | null;
    }[])) {
      details.set(s.profile_id, [s.program, s.year_level].filter(Boolean).join(" · ") || "Student");
    }
    for (const f of ((faculty.data ?? []) as { profile_id: string; department: string | null }[])) {
      if (f.department) details.set(f.profile_id, f.department);
    }
  }

  return {
    me: user.id,
    rows,
    details,
    page,
    size,
    total,
    hasMore: from + rows.length < total,
    stats,
  };
}

/**
 * Cached users directory — one cache entry per page + role/status/search.
 * `keepPreviousData` keeps the previous page on screen while the next fetch
 * runs, so the table can swap to skeleton rows instead of going blank.
 */
export function useUsersBoard(scope: UsersScope = DEFAULT_USERS_SCOPE) {
  return useQuery({
    queryKey: [...USERS_BOARD_KEY, scope.page, scope.size, scope.role, scope.status, scope.query],
    queryFn: () => fetchUsersBoard(scope),
    staleTime: USERS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
