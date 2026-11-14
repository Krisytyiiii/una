"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Search, SlidersHorizontal, Users, X } from "lucide-react";
import {
  useUsersBoard,
  type UsersProfile,
  type UsersStats,
} from "@/lib/hooks/use-users-board";
import { clampPage } from "@/lib/pagination";
import { Pager } from "@/components/shared/Pager";
import { HoverMenu } from "@/components/shared/hover-menu";
import { ROLES, ROLE_LABEL } from "@/components/users/RolePill";
import { UserRow } from "@/components/users/UserRow";
import { UsersHeader } from "@/components/users/UsersHeader";
import { UsersSkeleton } from "@/components/shared/skeletons";
import { Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Profile = UsersProfile;

const EMPTY_ROWS: Profile[] = [];
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
/** The directory is fixed at 10 rows per page. */
const USERS_PAGE_SIZE = 10;
/** Wait for typing to settle before hitting the server with a search term. */
const SEARCH_DEBOUNCE_MS = 250;

/** Admin user directory — stats, filters, and activate/deactivate (via a service-role route). */
export default function AdminUsersPage() {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <AdminUsersPageInner />
    </Suspense>
  );
}

function AdminUsersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // URL-driven pager (?page=, fixed 10 rows). The table itself is fetched per
  // page; the header stats come from the same board payload.
  const page = clampPage(searchParams.get("page"));
  const size = USERS_PAGE_SIZE;
  const gotoPage = useCallback(
    (p: number) => {
      router.replace(`/users?page=${p}`, { scroll: false });
    },
    [router]
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleFilter, setRoleFilterState] = useState<string>("all");
  const [statusFilter, setStatusFilterState] = useState<string>("all");
  const [query, setQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search term so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const { data: board, isLoading, isPlaceholderData, isError, refetch } = useUsersBoard({
    page,
    size,
    role: roleFilter,
    status: statusFilter,
    query: debouncedQuery,
  });
  const me = board?.me ?? null;
  const rows = board?.rows ?? EMPTY_ROWS;
  const details = board?.details ?? EMPTY_DETAILS;
  const stats = board?.stats ?? EMPTY_STATS;
  const total = board?.total ?? 0;
  const loading = isLoading && !board;
  // keepPreviousData keeps the old page mounted during a page/filter/search
  // fetch, so swap the table to skeleton rows instead of showing stale rows.
  const tableLoading = loading || isPlaceholderData;

  // Any filter change resets to page 1 (page window belongs to a result set).
  const setRoleFilter = useCallback((v: string) => { setRoleFilterState(v); gotoPage(1); }, [gotoPage]);
  const setStatusFilter = useCallback((v: string) => { setStatusFilterState(v); gotoPage(1); }, [gotoPage]);
  const setQuery = useCallback(
    (v: string) => {
      setQueryState(v);
      if (page !== 1) gotoPage(1);
    },
    [page, gotoPage]
  );
  const [confirming, setConfirming] = useState<{ user: Profile; toActive: boolean } | null>(null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load users right now.");
  }, [isError]);

  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total ? (safePage - 1) * size + 1 : 0;
  const rangeEnd = Math.min(safePage * size, total);

  // Deep links / shrinking result sets can point past the last page — walk
  // back to the last real page once the total is known.
  useEffect(() => {
    if (board && page > totalPages) gotoPage(totalPages);
  }, [board, page, totalPages, gotoPage]);

  const runConfirming = async () => {
    if (!confirming || busyId) return;
    const { user, toActive } = confirming;
    setBusyId(user.id);
    try {
      const res = await fetch("/api/staff/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isActive: toActive }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't update that account.");
      await refetch();
      toast.success(toActive ? "Account activated." : "Account deactivated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update that account.");
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  };

  const runApproving = async (user: Profile) => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const res = await fetch("/api/staff/users/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Couldn't approve that account.");
      await refetch();
      toast.success(`${user.full_name ?? user.email} can now finish setting up their staff profile.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't approve that account.");
    } finally {
      setBusyId(null);
    }
  };

  const resetFilters = useCallback(() => {
    setRoleFilterState("all");
    setStatusFilterState("all");
    setQueryState("");
    setDebouncedQuery("");
    gotoPage(1);
  }, [gotoPage]);

  const statusTabs = [
    { id: "all", label: "All", count: stats.total },
    { id: "active", label: "Active", count: stats.active },
    { id: "pending", label: "Pending", count: stats.pending },
    { id: "inactive", label: "Deactivated", count: stats.inactive },
  ] as const;

  const hasFilters = roleFilter !== "all" || statusFilter !== "all" || query.trim() !== "";

  return (
    <div className="space-y-4">
      <UsersHeader
        loading={loading}
        stats={stats}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        onRoleFilter={setRoleFilter}
        onReset={resetFilters}
      />

      {/* Directory — status tabs + search + role filter above the table. */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-ink/5 px-4 pb-0 pt-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-ink">Accounts</h2>
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 ring-1 ring-inset ring-primary-100">
                  {loading ? "…" : total}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                {hasFilters
                  ? "Filtered view — reset to see the whole directory."
                  : "Newest accounts first. Click a status card above to focus the list."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email…"
                  aria-label="Search accounts by name or email"
                  className="h-8 w-full rounded-lg border border-ink/15 bg-white pl-8 pr-8 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:w-60"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition hover:bg-ink/10 hover:text-ink"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </div>

              <HoverMenu
                ariaLabel="Filter by role"
                align="right"
                buttonLabel={
                  <span className="inline-flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary-600" aria-hidden />
                    {roleFilter === "all"
                      ? "All roles"
                      : roleFilter === "staff"
                        ? "Staff only"
                        : (ROLE_LABEL[roleFilter] ?? "All roles")}
                  </span>
                }
                options={[
                  { value: "all", label: `All roles · ${stats.total}` },
                  { value: "staff", label: `Staff only · ${stats.staff}` },
                  ...ROLES.map((r) => ({ value: r, label: `${ROLE_LABEL[r]} · ${stats.byRole.get(r) ?? 0}` })),
                ]}
                value={roleFilter}
                onPick={setRoleFilter}
              />

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-bold text-ink-muted transition hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Reset
                </button>
              )}
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Filter accounts by status"
            className="mt-3 flex gap-1 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {statusTabs.map((t) => {
              const active = statusFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(t.id)}
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    active
                      ? "bg-primary-600 text-white shadow-soft"
                      : "text-ink-muted hover:bg-cream hover:text-ink"
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-ink/10 text-ink-muted"
                    )}
                  >
                    {loading ? "…" : t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-cream/40 text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
                <th scope="col" className="px-4 py-2.5 font-bold sm:px-5">User</th>
                <th scope="col" className="px-4 py-2.5 font-bold">Role</th>
                <th scope="col" className="px-4 py-2.5 font-bold">Detail</th>
                <th scope="col" className="px-4 py-2.5 text-center font-bold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-bold">Joined</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">Access</th>
              </tr>
            </thead>
            <tbody aria-busy={tableLoading}>
              {tableLoading
                ? Array.from({ length: Math.min(Math.max(size, 3), 10) }).map((_, i) => (
                    <tr key={`user-skeleton-${i}`} className="border-b border-ink/5 align-middle last:border-0" aria-hidden>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-ink/10" />
                          <div className="min-w-0 flex-1">
                            <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
                            <div className="mt-1.5 h-3 w-36 animate-pulse rounded bg-ink/10" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-ink/10" /></td>
                      <td className="px-4 py-3"><div className="mx-auto h-5 w-20 animate-pulse rounded-full bg-ink/10" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-ink/10" /></td>
                      <td className="px-4 py-3"><div className="ml-auto h-8 w-24 animate-pulse rounded-lg bg-ink/10" /></td>
                    </tr>
                  ))
                : rows.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      isSelf={u.id === me}
                      busy={busyId === u.id}
                      detail={details.get(u.id)}
                      onAccessToggle={(user) => setConfirming({ user, toActive: !user.is_active })}
                      onApprove={runApproving}
                    />
                  ))}
            </tbody>
          </table>
          {!tableLoading && !rows.length && (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink-faint ring-1 ring-ink/5">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-2.5 text-sm font-bold text-ink">No accounts match these filters</p>
              <p className="mt-0.5 max-w-[320px] text-[12.5px] leading-relaxed text-ink-muted">
                Try another role or status, or clear the search to see the whole directory.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 inline-flex h-6 items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 text-[11.5px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 px-4 sm:px-5">
          <p className="pl-1 text-[11.5px] font-medium text-ink-muted">
            {tableLoading
              ? "Loading accounts…"
              : !total
                ? "No accounts to show"
                : `Showing ${rangeStart}–${rangeEnd} of ${total} account${total === 1 ? "" : "s"}`}
          </p>
          <Pager
            page={safePage}
            size={size}
            totalApprox={total}
            hasMore={safePage * size < total}
            onPage={(p) => gotoPage(p)}
            busy={tableLoading}
          />
        </div>
      </Card>

      {/* Activate/deactivate confirm */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="user-status-title"
          aria-describedby="user-status-desc"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={busyId ? undefined : () => setConfirming(null)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-ink/5">
            <div
              className={cn(
                "flex items-start gap-3 border-b px-5 py-4",
                confirming.toActive
                  ? "border-emerald-100 bg-gradient-to-br from-white via-cream to-emerald-50"
                  : "border-red-100 bg-gradient-to-br from-white via-cream to-red-50"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-soft",
                  confirming.toActive ? "bg-emerald-600" : "bg-red-600"
                )}
              >
                {confirming.toActive ? (
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                ) : (
                  <ShieldAlert className="h-5 w-5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="user-status-title" className="font-display text-lg font-bold leading-tight text-ink">
                  {confirming.toActive ? "Activate" : "Deactivate"}{" "}
                  {confirming.user.full_name ?? confirming.user.email}?
                </h2>
                <p id="user-status-desc" className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                  {confirming.toActive
                    ? "They'll be able to sign in and use the workspace again."
                    : "They'll be signed out and blocked at login until reactivated. Their records stay intact."}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-3">
              <p className="text-[11px] leading-snug text-ink-faint">
                {confirming.toActive ? "Access can be switched off later." : "You can reactivate any time."}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming(null)}
                  disabled={busyId === confirming.user.id}
                  autoFocus
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={confirming.toActive ? "primary" : "danger"}
                  loading={busyId === confirming.user.id}
                  onClick={runConfirming}
                >
                  {confirming.toActive ? "Activate account" : "Deactivate account"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
