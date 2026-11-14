import {
  Building2,
  GraduationCap,
  Hash,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EmergencyIdentity = {
  fullName: string | null;
  email: string | null;
  studentNo: string;
  program: string | null;
  yearLevel: string | null;
  college: string | null;
  contactNo: string | null;
  alias: string | null;
};

function initials(name: string | null): string {
  if (!name) return "ID";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ID";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Revealed-identity panel — audit notice, identity summary, and a scannable
 * field grid. The page can hide the panel again without closing the grant.
 */
export function IdentityCard({
  identity,
  onHide,
}: {
  identity: EmergencyIdentity;
  onHide?: () => void;
}) {
  const fields: { icon: typeof User; label: string; value: string | null; mono?: boolean }[] = [
    { icon: User, label: "Full name", value: identity.fullName },
    { icon: Hash, label: "Student no.", value: identity.studentNo, mono: true },
    { icon: Mail, label: "Email", value: identity.email },
    { icon: GraduationCap, label: "Program", value: identity.program },
    { icon: GraduationCap, label: "Year level", value: identity.yearLevel },
    { icon: Building2, label: "College", value: identity.college },
    { icon: Phone, label: "Contact no.", value: identity.contactNo },
    { icon: UserX, label: "Alias", value: identity.alias },
  ];

  return (
    <div id="identity-panel" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <div>
            <p className="text-[13px] font-bold text-red-800">This view is audit-logged under your name.</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-red-700">
              Handle these details with care — hide the panel when the crisis is managed.
            </p>
          </div>
        </div>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="inline-flex h-7 items-center rounded-md border border-red-200 bg-white px-2.5 text-[11.5px] font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Hide identity
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream/40 px-4 py-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white"
        >
          {initials(identity.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-ink">{identity.fullName ?? "Identity revealed"}</p>
          <p className="truncate text-[12px] text-ink-muted">
            {identity.studentNo}
            {identity.program ? ` · ${identity.program}` : ""}
          </p>
        </div>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-lg border border-ink/10 bg-ink/10 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start gap-2.5 bg-white px-4 py-3">
            <f.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{f.label}</dt>
              <dd className={cn("mt-0.5 break-words text-[13px] font-semibold text-ink", f.mono && "font-mono")}>
                {f.value ?? "—"}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
