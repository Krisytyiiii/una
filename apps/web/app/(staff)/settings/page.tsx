"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { removeAvatar, uploadAvatar } from "@dorsu/shared-services";
import { SETTINGS_BOARD_KEY, useSettingsBoard } from "@/lib/hooks/use-settings-board";
import { useAvatarUrl } from "@/lib/hooks/use-avatar-url";
import { Activity, ChevronRight, ShieldAlert, ShieldCheck, Sparkles, User, Users } from "lucide-react";
import { ProfileAbout, ProfileForm, type ProfileChecklistItem } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { WorkspaceForm, WorkspaceOverview } from "@/components/settings/WorkspaceOverview";
import { ActivitySection, TeamSection } from "@/components/settings/TeamList";
import { cn } from "@/lib/utils";

type Counselor = { id: string; name: string; spec: string | null; available: boolean; sessions: number };
type FeedItem = { id: string; at: string; text: string; tone: "info" | "success" | "warning" | "danger" };
type Post = { id: string; title: string; created_at: string; published_at: string | null };

const EMPTY_COUNSELORS: Counselor[] = [];
const EMPTY_FEED: FeedItem[] = [];
const EMPTY_POSTS: Post[] = [];
const EMPTY_GLANCE = { sessionsToday: 0, openReferrals: 0, published: 0 };

type TabDef = { value: string; label: string; description: string; count?: number; icon: typeof User };

/**
 * Shared /settings — profile, password, and email for counselors, faculty,
 * admins, and the head. The head additionally gets workspace, team, and
 * activity management. Laid out as a settings console: identity hero on top,
 * a sticky section rail on the left, and the active panel on the right.
 */
export default function SettingsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: board, isLoading, isError } = useSettingsBoard();
  const me = board?.me ?? null;
  const role = board?.role ?? null;
  const isHead = role === "guidance_head";
  const joined = board?.joined ?? "";
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const feed = board?.feed ?? EMPTY_FEED;
  const posts = board?.posts ?? EMPTY_POSTS;
  const glance = board?.glance ?? EMPTY_GLANCE;
  const loading = isLoading && !board;
  const { data: avatarDisplay = null } = useAvatarUrl(board?.avatarUrl);
  // Editable copies — seeded from the cache once per visit so typing never
  // fights a background refetch.
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [officeContact, setOfficeContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const pwRules = [
    { label: "At least 8 characters", ok: newPw.length >= 8 },
    { label: "Upper and lower case letters", ok: /[a-z]/.test(newPw) && /[A-Z]/.test(newPw) },
    { label: "At least one number", ok: /\d/.test(newPw) },
  ];
  const pwMatch = !confirmPw ? null : confirmPw === newPw && newPw.length > 0;

  useEffect(() => {
    if (isError) toast.error("Couldn't load settings right now.");
  }, [isError]);

  // Seed the editable copies from the cache once per visit so typing never
  // fights a background refetch. The email heal stays here (a write), never
  // in the cached query: email changed + confirmed elsewhere means auth is
  // source of truth, so the directory copy is healed silently.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!board || seededRef.current) return;
    seededRef.current = true;
    setEmail(board.email);
    setNewEmail(board.email);
    setFullName(board.fullName);
    setOfficeName(board.office.name);
    setOfficeLocation(board.office.location);
    setOfficeContact(board.office.contact);
    if (board.authEmail && board.email && board.authEmail.toLowerCase() !== board.email.toLowerCase() && board.me) {
      const healed = board.authEmail;
      const who = board.me;
      void createClient()
        .from("profiles")
        .update({ email: healed })
        .eq("id", who)
        .then(({ error: healErr }) => {
          if (!healErr) {
            setEmail(healed);
            setNewEmail(healed);
            toast.success("Email updated everywhere.");
          }
        });
    }
  }, [board]);

  const checklist = useMemo<ProfileChecklistItem[]>(
    () =>
      isHead
        ? [
            { label: "Full name", ok: fullName.trim().length >= 2 },
            { label: "Office name", ok: officeName.trim().length > 0 },
            { label: "Office location", ok: officeLocation.trim().length > 0 },
            { label: "Office contact", ok: officeContact.trim().length > 0 },
          ]
        : [{ label: "Full name", ok: fullName.trim().length >= 2 }],
    [fullName, officeName, officeLocation, officeContact, isHead]
  );

  const completeness = useMemo(() => {
    const done = checklist.filter((c) => c.ok).length;
    return Math.round((done / checklist.length) * 100);
  }, [checklist]);

  const saveProfile = async () => {
    if (!me || fullName.trim().length < 2) {
      toast.error("Name needs at least 2 characters.");
      return;
    }
    setSaving("profile");
    try {
      const { error } = await createClient().from("profiles").update({ full_name: fullName.trim() }).eq("id", me);
      if (error) throw error;
      setEditing(false);
      void qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      toast.success("Profile updated.");
    } catch {
      toast.error("Couldn't update profile — please try again.");
    } finally {
      setSaving(null);
    }
  };

  /** Uploaded photos live in the private `avatars` bucket (00066). */
  const pickAvatar = async (file: File) => {
    if (!me) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Keep the photo under 5 MB.");
      return;
    }
    setSaving("avatar");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await uploadAvatar(createClient(), {
        profileId: me,
        previousPath: board?.avatarUrl ?? null,
        bytes,
        contentType: file.type,
      });
      await qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      router.refresh(); // re-render the server layout so the nav avatar updates
      toast.success("Profile photo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload that photo — please try again.");
    } finally {
      setSaving(null);
    }
  };

  const dropAvatar = async () => {
    if (!me || !board?.avatarUrl) return;
    setSaving("avatar");
    try {
      await removeAvatar(createClient(), me, board.avatarUrl);
      await qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      router.refresh();
      toast.success("Profile photo removed.");
    } catch {
      toast.error("Couldn't remove that photo — please try again.");
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8 || !/[a-z]/.test(newPw) || !/[A-Z]/.test(newPw) || !/\d/.test(newPw) || newPw.length > 72) {
      toast.error("Password must be 8+ characters with upper, lower case and a number.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Those passwords don't match.");
      return;
    }
    setSaving("password");
    try {
      const { error } = await createClient().auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw("");
      setConfirmPw("");
      setPwDone(false);
      toast.success("Password changed — use it next time you log in.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change password.");
    } finally {
      setSaving(null);
    }
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (next.toLowerCase() === email.toLowerCase()) {
      toast.error("That's already your email.");
      return;
    }
    setSaving("email");
    try {
      const { error } = await createClient().auth.updateUser({ email: next });
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      toast.success("Confirmation sent — approve it in both inboxes, then your email switches over.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the email change.");
    } finally {
      setSaving(null);
    }
  };

  const saveOffice = async () => {
    if (!isHead) return;
    if (!officeName.trim()) {
      toast.error("Office name can't be empty.");
      return;
    }
    setSaving("office");
    try {
      const { error } = await createClient()
        .from("workspace_settings")
        .upsert(
          {
            key: "office",
            value: { name: officeName.trim(), location: officeLocation.trim(), contact: officeContact.trim() },
            updated_by: me,
          },
          { onConflict: "key" }
        );
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      toast.success("Workspace saved — sidebar updates within a minute.");
    } catch {
      toast.error("Couldn't save workspace — please try again.");
    } finally {
      setSaving(null);
    }
  };

  const finishSetup = () => {
    setTab("overview");
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!loading && (!role || !["counselor", "guidance_head", "faculty", "admin"].includes(role))) {
    return (
      <div className="w-full space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 p-5 shadow-card sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-200/40 blur-2xl" />
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary-700">
            <User className="h-3.5 w-3.5" aria-hidden />
            Account
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Settings</h1>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <ShieldAlert className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Only counselors, faculty, admins, and the guidance head can open settings.
          </p>
        </div>
      </div>
    );
  }

  const roleLabel = isHead ? "Guidance head" : role === "admin" ? "Admin" : role === "faculty" ? "Faculty" : "Counselor";

  const tabDefs: TabDef[] = [
    { value: "overview", label: "Overview", description: "Identity & directory", icon: User },
    ...(isHead
      ? [{ value: "team", label: "Team", description: "Counselors and load", count: counselors.length, icon: Users }]
      : []),
    { value: "activity", label: "Activity", description: "Your recent actions", count: feed.length, icon: Activity },
    { value: "security", label: "Security", description: "Password & email", icon: ShieldCheck },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Identity hero */}
      <ProfileForm
        loading={loading}
        fullName={fullName}
        email={email}
        roleLabel={roleLabel}
        isHead={isHead}
        officeLocation={officeLocation}
        joined={joined}
        completeness={completeness}
        editing={editing}
        saving={saving}
        avatarUrl={avatarDisplay}
        avatarBusy={saving === "avatar"}
        checklist={checklist}
        onFullNameChange={setFullName}
        onAvatarPick={(file) => void pickAvatar(file)}
        onAvatarRemove={() => void dropAvatar()}
        onEditToggle={() => (editing ? void saveProfile() : setEditing(true))}
      />

      {/* Completeness nudge — only while there is something left to fill in. */}
      {!loading && completeness < 100 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-accent-300 bg-accent-50/80 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[12.5px] font-semibold text-ink">
              Your profile is {completeness}% complete — finish the rest so the office directory stays accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={finishSetup}
            className="inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-full bg-accent-600 px-3 text-[11.5px] font-bold text-white shadow-soft transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:self-auto"
          >
            Finish setup
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Settings console — sticky rail + panel */}
      <div className="grid items-start gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4">
          <nav
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="vertical"
            className="flex gap-1 overflow-x-auto rounded-xl border border-ink/10 bg-white p-1.5 shadow-card lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-2"
          >
            <p className="hidden px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint lg:block">
              Settings
            </p>
            {tabDefs.map((t) => {
              const selected = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 lg:w-full lg:rounded-xl",
                    selected ? "bg-primary-600 text-white shadow-soft" : "text-ink-muted hover:bg-cream hover:text-ink"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition lg:h-7 lg:w-7",
                      selected ? "bg-white/15 text-white" : "bg-cream text-primary-600 group-hover:bg-white"
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold leading-tight">{t.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 hidden truncate text-[10.5px] font-medium lg:block",
                        selected ? "text-primary-100" : "text-ink-faint"
                      )}
                    >
                      {t.description}
                    </span>
                  </span>
                  {typeof t.count === "number" && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 text-[10px] font-bold",
                        selected ? "bg-white/20 text-white" : "bg-cream text-ink-muted"
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          {tab === "overview" && (
            <div
              className={cn(
                "space-y-4",
                isHead && "xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-4 xl:space-y-0"
              )}
              role="tabpanel"
            >
              <div className="min-w-0 space-y-4">
                <ProfileAbout
                  loading={loading}
                  fullName={fullName}
                  roleLabel={roleLabel}
                  email={email}
                  isHead={isHead}
                  officeName={officeName}
                  officeLocation={officeLocation}
                  officeContact={officeContact}
                />
                {isHead && (
                  <WorkspaceForm
                    officeName={officeName}
                    officeLocation={officeLocation}
                    officeContact={officeContact}
                    saving={saving}
                    onOfficeName={setOfficeName}
                    onOfficeLocation={setOfficeLocation}
                    onOfficeContact={setOfficeContact}
                    onSave={() => void saveOffice()}
                  />
                )}
              </div>
              {isHead && (
                <div className="min-w-0">
                  <WorkspaceOverview
                    loading={loading}
                    counselorsCount={counselors.length}
                    sessionsToday={glance.sessionsToday}
                    openReferrals={glance.openReferrals}
                    published={glance.published}
                    posts={posts}
                  />
                </div>
              )}
            </div>
          )}

          {isHead && tab === "team" && <TeamSection loading={loading} counselors={counselors} />}

          {tab === "activity" && <ActivitySection loading={loading} feed={feed} />}

          {tab === "security" && (
            <PasswordForm
              newPw={newPw}
              confirmPw={confirmPw}
              showPw={showPw}
              showConfirm={showConfirm}
              pwDone={pwDone}
              pwRules={pwRules}
              pwMatch={pwMatch}
              saving={saving}
              email={email}
              newEmail={newEmail}
              onNewPw={setNewPw}
              onConfirmPw={setConfirmPw}
              onShowPw={() => setShowPw((v) => !v)}
              onShowConfirm={() => setShowConfirm((v) => !v)}
              onPwBlur={() => setPwDone(true)}
              onNewEmail={setNewEmail}
              onChangePassword={(e) => void changePassword(e)}
              onChangeEmail={(e) => void changeEmail(e)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
