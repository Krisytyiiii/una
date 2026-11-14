"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, ChevronRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AboutWorkspace } from "@/components/about/about-workspace";

/**
 * /about — the in-app handbook, strictly role-scoped: counselors only ever
 * see the counselor guide, the head only ever sees the head guide, and
 * faculty only ever see the faculty guide. No tabs, no cross-viewing.
 * Layout + interactivity live in AboutWorkspace; copy lives in lib/about-content.
 */
export default function AboutPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setRole((profile as { role: string } | null)?.role ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="animate-pulse rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-8" aria-hidden>
          <div className="h-3 w-36 rounded-full bg-ink/10" />
          <div className="mt-3 h-7 w-64 rounded-lg bg-ink/10" />
          <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-ink/10" />
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[70px] rounded-xl bg-ink/10" />
            ))}
          </div>
        </div>
        <div className="h-12 animate-pulse rounded-xl bg-ink/10" aria-hidden />
        <div className="h-40 animate-pulse rounded-xl bg-ink/10" aria-hidden />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-8 text-center shadow-card">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl"
          />
          <div className="relative">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-card ring-1 ring-primary-100">
              <BookMarked className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">About this workspace</h1>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
              This handbook documents the counselor, head, and faculty workflows. Your home is the
              Dashboard — your referrals, their status, and your outcomes live there.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-[12.5px] font-bold text-white shadow-soft transition hover:bg-primary-700"
              >
                Open Dashboard
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 text-[11.5px] font-bold text-ink-muted">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Role-scoped view
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AboutWorkspace role={role} />;
}
