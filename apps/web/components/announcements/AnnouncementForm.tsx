"use client";

import { useState, type BaseSyntheticEvent } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { AnnouncementInput } from "@dorsu/shared-schemas";
import { Briefcase, GraduationCap, ImagePlus, PenLine, Send, UserCog, X } from "lucide-react";
import { initials } from "@/lib/format";
import { Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export const AUDIENCES = [
  { value: "student", label: "Students", icon: GraduationCap },
  { value: "counselor", label: "Counselors", icon: UserCog },
  { value: "faculty", label: "Faculty", icon: Briefcase },
] as const;

export type AudienceValue = (typeof AUDIENCES)[number]["value"];

/** Soft ceiling for the body counter — the schema allows more, this is advice. */
const BODY_SOFT_MAX = 600;

/**
 * Head-only composer. Starts collapsed as a single prompt row (like a social
 * feed) and expands into the full editor on click; page owns useForm + image
 * and audience state.
 */
export function AnnouncementForm({
  myName,
  register,
  errors,
  audience,
  onToggleAudience,
  imagePreview,
  fileRef,
  onPickFile,
  onClearImage,
  onSubmit,
  onSaveDraft,
  saving,
}: {
  myName: string;
  register: UseFormRegister<AnnouncementInput>;
  errors: FieldErrors<AnnouncementInput>;
  audience: AudienceValue[];
  onToggleAudience: (v: AudienceValue) => void;
  imagePreview: string | null;
  fileRef: { readonly current: HTMLInputElement | null };
  onPickFile: (f: File | undefined) => void;
  onClearImage: () => void;
  onSubmit: (e?: BaseSyntheticEvent) => Promise<void>;
  onSaveDraft: () => void;
  saving: null | "draft" | "publish";
}) {
  const [open, setOpen] = useState(false);
  const [bodyLen, setBodyLen] = useState(0);
  const bodyReg = register("body");
  const firstName = myName.split(" ")[0];

  const avatar = (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-700 font-display text-sm font-bold text-white ring-2 ring-primary-100"
    >
      {initials(myName)}
    </span>
  );

  if (!open) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          {avatar}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 min-w-0 flex-1 rounded-full border border-ink/10 bg-cream/60 px-4 text-left text-[13px] font-medium text-ink-faint transition hover:border-primary-300 hover:bg-white hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Share an update, {firstName}…
          </button>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Photo
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold text-ink">New announcement</p>
          <p className="text-[11.5px] font-medium text-ink-muted">Posting as {myName}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse composer"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <form className="mt-3 space-y-3" onSubmit={onSubmit}>
        <div>
          <Input
            placeholder="Post title — e.g. Booking opens for finals week"
            className="h-10 text-[15px] font-semibold"
            {...register("title")}
          />
          <FieldError message={errors.title?.message} />
        </div>
        <div>
          <Textarea
            rows={4}
            placeholder="What's happening? Keep it short and warm."
            {...bodyReg}
            onChange={(e) => {
              bodyReg.onChange(e);
              setBodyLen(e.target.value.length);
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <FieldError message={errors.body?.message} />
            <span
              className={cn(
                "ml-auto font-mono text-[11px] font-semibold tabular-nums",
                bodyLen > BODY_SOFT_MAX ? "text-amber-600" : "text-ink-faint"
              )}
            >
              {bodyLen}
              <span className="text-ink-faint/70">/{BODY_SOFT_MAX}</span>
            </span>
          </div>
        </div>

        {imagePreview ? (
          <div className="relative overflow-hidden rounded-lg border border-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Attached preview" className="max-h-64 w-full object-cover" />
            <button
              type="button"
              onClick={onClearImage}
              aria-label="Remove image"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink shadow-card transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Attach a photo"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />

        <div className="rounded-lg border border-ink/10 bg-cream/40 px-3 py-2.5">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-faint">Audience</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Audience (none ticked means everyone)">
            {AUDIENCES.map((a) => {
              const on = audience.includes(a.value);
              return (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggleAudience(a.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    on
                      ? "bg-primary-600 text-white shadow-soft"
                      : "border border-ink/10 bg-white text-ink-soft hover:border-primary-300 hover:text-primary-700"
                  )}
                >
                  <a.icon className="h-3.5 w-3.5" aria-hidden />
                  {a.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] font-medium text-ink-faint">None ticked = everyone sees it.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            {imagePreview ? "Change photo" : "Add photo"}
          </Button>
          <div className="flex gap-1.5">
            <Button type="button" variant="ghost" size="sm" disabled={!!saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={saving === "draft"}
              disabled={!!saving}
              onClick={onSaveDraft}
              className="gap-1.5"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              {saving === "draft" ? "Saving…" : "Save draft"}
            </Button>
            <Button size="sm" loading={saving === "publish"} disabled={!!saving} className="gap-1.5">
              <Send className="h-3.5 w-3.5" aria-hidden />
              {saving === "publish" ? "Posting…" : "Post now"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
