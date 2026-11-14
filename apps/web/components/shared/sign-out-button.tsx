"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Signs the staff member out and returns to the login page. */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-ink/10 bg-cream/60 px-4 text-[13px] font-bold text-ink-soft transition hover:border-ink/20 hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
