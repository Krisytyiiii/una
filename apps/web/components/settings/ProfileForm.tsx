"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui/primitives";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProfileChecklistItem = { label: string; ok: boolean };

/**
 * Profile hero — gradient banner, avatar, identity meta, and a completeness
 * ring with an expandable checklist. Inline edit fields are unchanged in
 * behaviour; only the presentation was rebuilt.
 */
export function ProfileForm({
  loading,
  fullName,
  email,
  roleLabel,
  isHead,
  officeLocation,
  joined,
  completeness,
  editing,
  saving,
  avatarUrl,
  avatarBusy,
  checklist,
  onFullNameChange,
  onAvatarPick,
  onAvatarRemove,
  onEditToggle,
}: {
  loading: boolean;
  fullName: string;
  email: string;
  roleLabel: string;
  isHead: boolean;
  officeLocation: string;
  joined: string;
  completeness: number;
  editing: boolean;
  saving: string | null;
  avatarUrl: string | null;
  avatarBusy: boolean;
  checklist: ProfileChecklistItem[];
  onFullNameChange: (v: string) => void;
  onAvatarPick: (file: File) => void;
  onAvatarRemove: () => void;
  onEditToggle: () => void;
}) {
  const [showChecklist, setShowChecklist] = useState(false);
  const remaining = checklist.filter((c) => !c.ok).length;
  const joinedLabel = joined
    ? new Date(joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <section className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <div
        aria-hidden
        className="relative h-24 bg-gradient-to-r from-primary-700 via-primary-600 to-accent-400 sm:h-28"
      >
        <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-white/10 blur-xl" />
        <span className="pointer-events-none absolute bottom-0 right-24 h-16 w-16 rounded-full bg-accent-200/40 blur-xl" />
        <p className="absolute bottom-3 left-5 hidden items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/80 sm:flex">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Account &amp; identity
        </p>
      </div>

      <div className="px-5 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="-mt-11 flex items-end gap-3 sm:-mt-12">
            <div className="relative shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-white sm:h-24 sm:w-24"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 font-display text-2xl font-bold text-white ring-4 ring-white sm:h-24 sm:w-24 sm:text-3xl"
                >
                  {loading ? "?" : initials(fullName || email)}
                </span>
              )}
              <label
                className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-white text-ink-muted shadow-sm transition hover:text-primary-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-400"
                title="Change profile photo"
              >
                <Camera aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">Change profile photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={avatarBusy || loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onAvatarPick(file);
                  }}
                />
              </label>
            </div>
            <div className="pb-1 leading-tight">
              <p className="font-display text-xl font-bold text-ink sm:text-2xl">{loading ? "…" : fullName || "Unnamed"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-ink-muted">
                <Badge tone={isHead ? "warning" : "info"}>{loading ? "…" : roleLabel}</Badge>
                {email && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
                    <span className="truncate">{email}</span>
                  </span>
                )}
                {joinedLabel && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 text-ink-faint" aria-hidden />
                    Joined {joinedLabel}
                  </span>
                )}
                {isHead && officeLocation && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-ink-faint" aria-hidden />
                    {officeLocation}
                  </span>
                )}
              </div>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={onAvatarRemove}
                  disabled={avatarBusy}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted transition hover:text-red-700 disabled:opacity-50"
                >
                  {avatarBusy ? (
                    <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 aria-hidden className="h-3 w-3" />
                  )}
                  {avatarBusy ? "Removing…" : "Remove photo"}
                </button>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant={editing ? "ghost" : "outline"}
            onClick={onEditToggle}
            loading={saving === "profile"}
            disabled={avatarBusy}
          >
            {saving === "profile" ? "Saving…" : editing ? "Done" : "Edit profile"}
          </Button>
        </div>

        {/* Completeness — ring + expandable checklist. */}
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CompletenessRing percent={completeness} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                <Sparkles className="h-3.5 w-3.5 text-accent-500" aria-hidden />
                {completeness === 100 ? "Profile complete" : "Profile completeness"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                {completeness === 100
                  ? "Everything the office directory needs is filled in."
                  : remaining === 1
                    ? "One field left — finish it to keep the directory accurate."
                    : `${remaining} fields left — finish them to keep the directory accurate.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowChecklist((v) => !v)}
            aria-expanded={showChecklist}
            className="inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-full border border-ink/10 bg-white px-2.5 text-[11px] font-bold text-ink-soft transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:self-auto"
          >
            {showChecklist ? "Hide checklist" : "View checklist"}
            <ChevronDown className={cn("h-3 w-3 transition-transform", showChecklist && "rotate-180")} aria-hidden />
          </button>
        </div>

        {showChecklist && (
          <ul className="mt-2 grid gap-1.5 rounded-xl bg-cream/50 p-3 sm:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    item.ok ? "bg-green-100 text-green-700" : "bg-ink/10 text-ink-faint"
                  )}
                >
                  {item.ok ? <Check className="h-3 w-3" aria-hidden /> : <span className="h-1 w-1 rounded-full bg-current" />}
                </span>
                <span className={item.ok ? "text-ink" : "text-ink-muted"}>{item.label}</span>
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="settings-name">Full name</label>
              <Input id="settings-name" value={fullName} onChange={(e) => onFullNameChange(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">Email (managed by Auth)</label>
              <Input value={email} disabled />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CompletenessRing({ percent }: { percent: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center" role="img" aria-label={`Profile ${percent}% complete`}>
      <svg viewBox="0 0 60 60" className="h-14 w-14 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" strokeWidth="6" className="stroke-ink/10" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-all duration-500", percent === 100 ? "stroke-green-500" : "stroke-primary-600")}
        />
      </svg>
      <span className="absolute font-display text-[12px] font-bold tabular-nums text-ink">{percent}%</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Directory details                                                   */
/* ------------------------------------------------------------------ */

/**
 * Directory card — read-only profile rows with one-tap copy.
 */
export function ProfileAbout({
  loading,
  fullName,
  roleLabel,
  email,
  isHead,
  officeName,
  officeLocation,
  officeContact,
}: {
  loading: boolean;
  fullName: string;
  roleLabel: string;
  email: string;
  isHead: boolean;
  officeName: string;
  officeLocation: string;
  officeContact: string;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(`${key} copied.`);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const rows: { key: string; label: string; value: string; icon: typeof Mail; mono?: boolean; copyable?: boolean }[] = [
    { key: "Name", label: "Full name", value: fullName || "—", icon: BadgeCheck },
    { key: "Email", label: "Email", value: email || "—", icon: Mail, copyable: true },
    { key: "Role", label: "Role", value: roleLabel, icon: Briefcase },
    ...(isHead
      ? [
          { key: "Office", label: "Office", value: officeName || "—", icon: Briefcase },
          { key: "Location", label: "Location", value: officeLocation || "—", icon: MapPin },
          { key: "Contact", label: "Contact", value: officeContact || "—", icon: Mail, copyable: true },
        ]
      : []),
  ];

  return (
    <section className="rounded-xl border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Directory details</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            How you appear to staff across the guidance office.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[10.5px] font-bold text-ink-muted ring-1 ring-ink/5">
          <BadgeCheck className="h-3 w-3 text-primary-600" aria-hidden />
          Read-only
        </span>
      </div>

      {loading ? (
        <div className="mt-3 grid animate-pulse gap-2 sm:grid-cols-2" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-ink/10" />
          ))}
        </div>
      ) : (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.key} className="group flex items-start gap-2.5 rounded-lg border border-ink/5 bg-cream/40 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 ring-1 ring-ink/5">
                <row.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">{row.label}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-semibold text-ink" title={row.value}>
                    {row.value}
                  </span>
                  {row.copyable && row.value !== "—" && (
                    <button
                      type="button"
                      onClick={() => void copy(row.key, row.value)}
                      aria-label={`Copy ${row.label.toLowerCase()}`}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition hover:bg-white hover:text-primary-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      {copiedKey === row.key ? (
                        <Check className="h-3 w-3 text-primary-600" aria-hidden />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden />
                      )}
                    </button>
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
