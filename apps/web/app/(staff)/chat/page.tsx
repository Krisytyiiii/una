"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, Inbox, Lock, MessageCircle, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  CHAT_BOARD_KEY,
  useChatBoard,
  type ChatBoardData,
  type ChatDm,
  type ChatMsg,
  type ChatThread,
} from "@/lib/hooks/use-chat-board";
import {
  getThreadWithMessages,
  markNotificationsRead,
  markStaffMessagesRead,
  sendMessage,
  sendStaffMessage,
} from "@dorsu/shared-services";
import { Badge, Card } from "@/components/ui/primitives";
import { initials } from "@/lib/format";
import { logEvent } from "@/lib/log-event";
import { patchBoard } from "@/lib/patch-board";
import {
  NOTIFICATIONS_BOARD_KEY,
  type NotificationsBoardData,
} from "@/lib/hooks/use-notifications-board";
import { notifyStaff } from "@/lib/notify";
import { ThreadList, avatarToneFor, type Convo } from "@/components/chat/ThreadList";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { NewMessageModal } from "@/components/chat/NewMessageModal";

type Thread = ChatThread;

type Msg = ChatMsg;

type Dm = ChatDm;

const LAST_CHAT_KEY = "chekie.chat.last";

function readLastChat(): { threadId: string | null; dmPeer: string | null } {
  try {
    const raw = localStorage.getItem(LAST_CHAT_KEY);
    if (!raw) return { threadId: null, dmPeer: null };
    const p = JSON.parse(raw) as { threadId?: unknown; dmPeer?: unknown };
    return {
      threadId: typeof p.threadId === "string" ? p.threadId : null,
      dmPeer: typeof p.dmPeer === "string" ? p.dmPeer : null,
    };
  } catch {
    return { threadId: null, dmPeer: null };
  }
}

function writeLastChat(v: { threadId: string | null; dmPeer: string | null }) {
  try {
    localStorage.setItem(LAST_CHAT_KEY, JSON.stringify(v));
  } catch {
    // Private mode etc. — persistence is best-effort.
  }
}

const EMPTY_THREADS: Thread[] = [];
const EMPTY_DMS: Dm[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_ALIASES = new Map<string, { alias: string; profileId: string }>();
const EMPTY_PREVIEWS = new Map<string, Msg>();

/**
 * Shared /chat — one URL, role-aware UI (same pattern as /appointments).
 * Counselors read + reply on their own threads; the head sees direct staff
 * messages with its contacts only — student–counselor threads are
 * participant-private (the head can neither list nor open them).
 */
export default function ChatPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError } = useChatBoard();
  const role = board?.role ?? null;
  const me = board?.me ?? null;
  const myName = board?.myName ?? "Staff";
  const ownCounselorId = board?.ownCounselorId ?? null;
  const threads = board?.threads ?? EMPTY_THREADS;
  const aliases = board?.aliases ?? EMPTY_ALIASES;
  const counselorNames = board?.counselorNames ?? EMPTY_MAP;
  const counselorProfiles = board?.counselorProfiles ?? EMPTY_MAP;
  const previews = board?.previews ?? EMPTY_PREVIEWS;
  const dms = board?.dms ?? EMPTY_DMS;
  const staffNames = board?.staffNames ?? EMPTY_MAP;
  const contacts = board?.contacts ?? [];
  const loading = isLoading && !board;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgCounselor, setMsgCounselor] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const onMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
  };

  const jumpToLatest = () => {
    atBottomRef.current = true;
    setShowJump(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  // Return to the last open chat once cached data arrives (validated —
  // stale ids are dropped). Runs once so background refetches never yank
  // the user away from the conversation they switched to.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!board || restoredRef.current) return;
    restoredRef.current = true;
    const last = readLastChat();
    if (last.threadId && board.threads.some((t) => t.id === last.threadId)) {
      setActiveId(last.threadId);
      setShowThreadMobile(true);
    } else if (
      last.dmPeer &&
      last.dmPeer !== board.me &&
      board.dms.some((d) => d.sender_profile_id === last.dmPeer || d.recipient_profile_id === last.dmPeer)
    ) {
      setActiveDm(last.dmPeer);
      setShowThreadMobile(true);
    }
  }, [board]);

  useEffect(() => {
    if (isError) toast.error("Couldn't load chats right now.");
  }, [isError]);

  // Active thread messages + realtime. History is bounded (latest 50 —
  // see getThreadWithMessages); "Load older" pages back via cursor below.
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setHasMoreHistory(false);
      return;
    }
    let alive = true;
    setHasMoreHistory(false);
    getThreadWithMessages(createClient(), activeId)
      .then(({ messages: ms }) => {
        if (!alive) return;
        const list = ((ms ?? []) as Msg[]);
        setMessages(list);
        setHasMoreHistory(list.length >= 50);
      })
      .catch(() => {});
    const ch = createClient()
      .channel(`thread-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${activeId}` },
        (p) => {
          const row = p.new as Msg;
          setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
          patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({ ...prev, previews: new Map(prev.previews).set(activeId, row) }));
        }
      )
      .subscribe();
    return () => {
      alive = false;
      createClient().removeChannel(ch);
    };
  }, [activeId]);

  // P10: older history on demand — prepends the next page without yanking
  // the viewport (scrollTop is preserved; auto-stick-to-bottom is off while
  // reading history, so the arrival effect below stays quiet).
  const loadOlder = () => {
    if (!activeId || !messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const oldest = messages[0]?.created_at;
    getThreadWithMessages(createClient(), activeId, { before: oldest })
      .then(({ messages: ms }) => {
        const page = ((ms ?? []) as Msg[]);
        atBottomRef.current = false;
        setShowJump(true);
        setMessages((m) => {
          const known = new Set(m.map((x) => x.id));
          return [...page.filter((x) => !known.has(x.id)), ...m];
        });
        if (page.length < 50) setHasMoreHistory(false);
      })
      .catch(() => {
        toast.error("Couldn't load older messages.");
      })
      .finally(() => setLoadingOlder(false));
  };

  // P9: visible-thread signature — the shared preview listener below
  // subscribes only to these thread ids (plus my DMs), never the whole
  // org's chat_messages table. Rebuilt when the thread set changes.
  const threadFilter = useMemo(
    () => threads.map((t) => t.id).slice(0, 100).sort().join(","),
    [threads]
  );

  // One shared channel for everything outside the open thread: thread-list
  // previews patch in place (never a full invalidate — the old chat-list
  // channel refetched the whole board on every message), and staff DMs land
  // live, filtered to messages addressed to me. The open thread keeps its
  // own filtered subchannel above. RLS still scopes chat_messages to
  // participant threads server-side; the thread_id=in.(...) filter narrows
  // realtime egress client-side so other counselors' messages never reach
  // this tab. Empty (faculty/head without threads) skips chat_messages.
  useEffect(() => {
    if (!me) return;
    const builder = createClient().channel(`chat-global-${me}`);
    if (threadFilter) {
      builder.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=in.(${threadFilter})` },
        (p) => {
          const row = p.new as Msg;
          if (!row?.id || !row.thread_id) return;
          patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({
            ...prev,
            previews: new Map(prev.previews).set(row.thread_id, row),
          }));
        }
      );
    }
    const ch = builder
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_messages", filter: `recipient_profile_id=eq.${me}` },
        (p) => {
          const row = p.new as Dm;
          patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) =>
            prev.dms.some((x) => x.id === row.id) ? prev : { ...prev, dms: [row, ...prev.dms] }
          );
        }
      )
      .subscribe();
    return () => {
      createClient().removeChannel(ch);
    };
  }, [me, qc, threadFilter]);

  // New arrivals stick to the bottom only while already viewing the latest —
  // reading history is never yanked away.
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, dms]);

  // Switching conversations always lands on the latest messages.
  useEffect(() => {
    atBottomRef.current = true;
    setShowJump(false);
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [activeId, activeDm]);

  // Persist the open chat locally (skipped until first load so boot never wipes it).
  useEffect(() => {
    if (loading) return;
    writeLastChat({ threadId: activeId, dmPeer: activeDm });
  }, [activeId, activeDm, loading]);

  // Message-counselor dialog: Escape closes, background stays put while open.
  useEffect(() => {
    if (!msgOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMsgOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [msgOpen]);

  const openMessenger = () => {
    // Faculty + counselor pick a profile id directly; the head picks a
    // counselor row that resolves to its profile below.
    const first = isFaculty || isCounselor
      ? (contacts[0]?.profileId ?? "")
      : ([...counselorNames.keys()][0] ?? "");
    setMsgCounselor((prev) => prev || first);
    setMsgOpen(true);
  };

  const sendToCounselor = async () => {
    const body = msgBody.trim();
    if (!me || !msgCounselor || !body || msgBusy) return;
    // Faculty + counselor compose is keyed by office profile id directly; the head
    // compose picks a counselor row and resolves its profile.
    const peerProfile = isFaculty || isCounselor ? msgCounselor : counselorProfiles.get(msgCounselor);
    if (!peerProfile) {
      toast.error("Couldn't find that counselor.");
      return;
    }
    setMsgBusy(true);
    // P14: optimistic — the DM renders and the view switches instantly;
    // the temp row is replaced by the server row (same replace-by-id the
    // realtime echo uses), removed on failure while staying on the view.
    const tempId = crypto.randomUUID();
    const optimistic: Dm = {
      id: tempId,
      sender_profile_id: me,
      recipient_profile_id: peerProfile,
      body,
      is_read: true,
      created_at: new Date().toISOString(),
    };
    patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) =>
      prev.dms.some((x) => x.id === tempId) ? prev : { ...prev, dms: [optimistic, ...prev.dms] }
    );
    setMsgOpen(false);
    setMsgBody("");
    setActiveId(null);
    setMessages([]);
    setActiveDm(peerProfile);
    setShowThreadMobile(true);
    try {
      const sent = (await sendStaffMessage(createClient(), { senderProfileId: me, recipientProfileId: peerProfile, body })) as Dm;
      patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({
        ...prev,
        dms: prev.dms.map((x) => (x.id === tempId ? sent : x)),
      }));
      // Fire-and-forget: dialog close reflects the sent message, not delivery.
      void notifyStaff([peerProfile], {
        type: "chat",
        title: `New message from ${myName}`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: "/chat",
        ...(sent?.id ? { dedupeKey: `chat:${sent.id}:dm` } : {}),
        tone: "info",
      });
    } catch (e) {
      patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({
        ...prev,
        dms: prev.dms.filter((x) => x.id !== tempId),
      }));
      logEvent("CHAT_SEND_FAILED", { role: role ?? "unknown", detail: e instanceof Error ? e.message : "unknown" });
      toast.error("Couldn't deliver the message — please try again.");
    } finally {
      setMsgBusy(false);
    }
  };

  const isOffice = role === "guidance_head";
  const isFaculty = role === "faculty";
  const isCounselor = role === "counselor";
  const contactOptions = contacts.map((c) => ({
    value: c.profileId,
    label: `${c.name} · ${c.role === "guidance_head" ? "Guidance Head" : c.role === "faculty" ? "Faculty" : "Counselor"}`,
  }));

  const dmGroups = useMemo(() => {
    const byPeer = new Map<string, Dm[]>();
    for (const d of dms) {
      const peer = d.sender_profile_id === me ? d.recipient_profile_id : d.sender_profile_id;
      if (!byPeer.has(peer)) byPeer.set(peer, []);
      byPeer.get(peer)!.push(d);
    }
    return [...byPeer.entries()].map(([peer, list]) => {
      const sorted = [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      return {
        peer,
        last: sorted[sorted.length - 1],
        unread: list.filter((x) => x.recipient_profile_id === me && !x.is_read).length,
      };
    });
  }, [dms, me]);

  const convos: Convo[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Convo[] = [];
    for (const t of threads) {
      if (statusFilter !== "all" && t.status !== statusFilter) continue;
      const alias = aliases.get(t.student_id)?.alias ?? "";
      const cname = (t.counselor_id && counselorNames.get(t.counselor_id)) || "";
      const preview = previews.get(t.id)?.body ?? "";
      if (q && !`${alias} ${cname} ${preview}`.toLowerCase().includes(q)) continue;
      // Order by the latest message when known — thread.updated_at can lag
      // rows written before the bump trigger (00032) existed.
      const previewAt = previews.get(t.id)?.created_at;
      const at = previewAt && previewAt > t.updated_at ? previewAt : t.updated_at;
      out.push({ kind: "thread", key: `t-${t.id}`, at, thread: t });
    }
    for (const g of dmGroups) {
      const name = staffNames.get(g.peer) ?? "Staff";
      if (q && !`${name} ${g.last.body}`.toLowerCase().includes(q)) continue;
      out.push({ kind: "dm", key: `d-${g.peer}`, at: g.last.created_at, peer: g.peer, last: g.last, unread: g.unread });
    }
    return out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [threads, dmGroups, search, statusFilter, aliases, counselorNames, previews, staffNames]);

  const dmHistory = useMemo(() => {
    if (!activeDm) return [];
    return dms
      .filter(
        (d) =>
          (d.sender_profile_id === me && d.recipient_profile_id === activeDm) ||
          (d.sender_profile_id === activeDm && d.recipient_profile_id === me)
      )
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, [dms, activeDm, me]);

  // Clear the sidebar/bell badge for the conversation being viewed. The
  // badge counts unread *notification* rows — opening a chat only marks the
  // message rows read, so without this the count sticks until the inbox is
  // visited. Matched per-conversation via dedupe_key; the DB UPDATE fans out
  // through the realtime channel and clears the badge on every open tab.
  const clearedNotifRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!me) return;
    const list = activeDm ? dmHistory : activeId ? messages : [];
    if (!list.length) return;
    const fresh = list.filter((m) => m.sender_profile_id !== me && !clearedNotifRef.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => clearedNotifRef.current.add(m.id));
    const keys = fresh.flatMap((m) => [`chat:${m.id}:dm`, `chat:${m.id}:thread`]);
    void (async () => {
      try {
        const db = createClient();
        const { data } = await db
          .from("notifications")
          .select("id")
          .eq("profile_id", me)
          .eq("type", "chat")
          .eq("is_read", false)
          .in("dedupe_key", keys);
        const ids = ((data ?? []) as { id: string }[]).map((n) => n.id);
        if (!ids.length) return;
        await markNotificationsRead(db, ids);
        patchBoard<NotificationsBoardData>(qc, [...NOTIFICATIONS_BOARD_KEY], (prev) => ({
          ...prev,
          rows: prev.rows.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
        }));
      } catch {
        // Badge converges via the realtime resync + inbox fallback.
      }
    })();
  }, [activeDm, activeId, dmHistory, messages, me, qc]);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeAlias = active ? (aliases.get(active.student_id)?.alias ?? "Student") : "";
  const activeCounselor = active?.counselor_id ? (counselorNames.get(active.counselor_id) ?? "Counselor") : "Unassigned";
  const iAmParticipant = !!active && role === "counselor" && active.counselor_id === ownCounselorId;
  const activeDmName = activeDm ? (staffNames.get(activeDm) ?? "Staff") : "";

  const needsReply = (t: Thread): boolean => {
    if (t.status !== "open") return false;
    const last = previews.get(t.id);
    if (!last) return true;
    const studentProfile = aliases.get(t.student_id)?.profileId;
    return !!studentProfile && last.sender_profile_id === studentProfile;
  };

  const openThreadCount = threads.filter((t) => t.status === "open").length;
  const threadCounts = {
    all: threads.length,
    open: openThreadCount,
    closed: threads.length - openThreadCount,
  };
  const awaitingCount = threads.filter(needsReply).length;
  const unreadDmCount = dmGroups.reduce((n, g) => n + g.unread, 0);

  const openThread = (id: string) => {
    setActiveDm(null);
    setActiveId(id);
    setShowThreadMobile(true);
  };

  const openDm = (peer: string) => {
    setActiveId(null);
    setMessages([]);
    setActiveDm(peer);
    setShowThreadMobile(true);
    if (me) {
      void markStaffMessagesRead(createClient(), { readerProfileId: me, counterpartProfileId: peer })
        .then(() =>
          patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({
            ...prev,
            dms: prev.dms.map((d) =>
              d.sender_profile_id === peer && d.recipient_profile_id === me ? { ...d, is_read: true } : d
            ),
          }))
        )
        .catch(() => {});
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !activeId || !draft.trim() || sending) return;
    // P14: optimistic send — the message renders + composer clears instantly.
    // The client UUID doubles as the idempotency key (service messageId):
    // a retry reuses it, and the realtime echo carries the same id, so the
    // temp row reconciles instead of duplicating. Failure rolls back and
    // restores the draft so no text is lost.
    const body = draft.trim();
    const threadId = activeId;
    const tempId = crypto.randomUUID();
    const optimistic: Msg = {
      id: tempId,
      thread_id: threadId,
      sender_profile_id: me,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    setSending(true);
    try {
      const sent = (await sendMessage(createClient(), {
        threadId,
        senderProfileId: me,
        body,
        messageId: tempId,
      })) as Msg;
      setMessages((m) => m.map((x) => (x.id === tempId ? sent : x)));
      const thread = threads.find((t) => t.id === threadId);
      const otherProfile = thread
        ? thread.counselor_id === ownCounselorId
          ? aliases.get(thread.student_id)?.profileId
          : counselorProfiles.get(thread.counselor_id ?? "")
        : null;
      // Fire-and-forget: composer reset reflects the sent message, not delivery.
      void notifyStaff([otherProfile], {
        type: "chat",
        title: `New message from ${myName}`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: "/chat",
        dedupeKey: `chat:${sent.id}:thread`,
        tone: "info",
      });
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setDraft(body);
      toast.error("Couldn't send — please try again.");
    } finally {
      setSending(false);
    }
  };

  const sendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !activeDm || !draft.trim() || sending) return;
    // P14: optimistic DM — temp row renders instantly, replaced by the
    // server row on success (realtime echo dedupes by id), removed on fail.
    const body = draft.trim();
    const peer = activeDm;
    const tempId = crypto.randomUUID();
    const optimistic: Dm = {
      id: tempId,
      sender_profile_id: me,
      recipient_profile_id: peer,
      body,
      is_read: true,
      created_at: new Date().toISOString(),
    };
    patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) =>
      prev.dms.some((x) => x.id === tempId) ? prev : { ...prev, dms: [optimistic, ...prev.dms] }
    );
    setDraft("");
    setSending(true);
    try {
      const sent = (await sendStaffMessage(createClient(), {
        senderProfileId: me,
        recipientProfileId: peer,
        body,
      })) as Dm;
      patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({
        ...prev,
        dms: prev.dms.map((x) => (x.id === tempId ? sent : x)),
      }));
      // Fire-and-forget: composer reset reflects the sent message, not delivery.
      void notifyStaff([peer], {
        type: "chat",
        title: `New message from ${myName}`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: "/chat",
        dedupeKey: `chat:${sent.id}:dm`,
        tone: "info",
      });
    } catch {
      patchBoard<ChatBoardData>(qc, [...CHAT_BOARD_KEY], (prev) => ({
        ...prev,
        dms: prev.dms.filter((x) => x.id !== tempId),
      }));
      setDraft(body);
      toast.error("Couldn't send — please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!loading && (!role || !["counselor", "guidance_head", "faculty"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Chat</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors, the guidance head, and faculty can open chat.</p></Card>
      </div>
    );
  }

  const showing = active ?? activeDm;

  return (
    <div className="space-y-3 lg:flex lg:h-[calc(100vh-5rem-1.5rem-1rem)] lg:flex-col lg:gap-3 lg:space-y-0 lg:overflow-hidden">
      {/* Hero — role-aware summary so the inbox reads like a workspace, not a list. */}
      <section className="relative shrink-0 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-cream to-blue-50 px-5 py-4 shadow-card sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-primary-200/40 blur-2xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-soft">
              <MessagesSquare className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">
                Guidance office · Messages
              </p>
              <h1 className="mt-0.5 font-display text-2xl font-bold text-ink">Checki chats</h1>
              <p className="mt-1 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">
                {isFaculty
                  ? "Talk to the guidance office about your referrals — replies land right here."
                  : isOffice
                    ? "Direct staff messages across the office. Student–counselor threads stay private to their participants."
                    : "Reply to students on your threads and coordinate with faculty — everything updates live."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-ink-soft ring-1 ring-ink/5">
              <MessagesSquare className="h-3 w-3 text-primary-600" aria-hidden />
              {convos.length} conversation{convos.length === 1 ? "" : "s"}
            </span>
            {isCounselor && (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                  <MessageCircle className="h-3 w-3" aria-hidden />
                  {openThreadCount} open
                </span>
                {awaitingCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-100">
                    <Clock className="h-3 w-3" aria-hidden />
                    {awaitingCount} awaiting reply
                  </span>
                )}
              </>
            )}
            {unreadDmCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700 ring-1 ring-inset ring-primary-100">
                <Inbox className="h-3 w-3" aria-hidden />
                {unreadDmCount} unread
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <ThreadList
          convos={convos}
          loading={loading}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          isOffice={isOffice}
          isFaculty={isFaculty}
          isCounselor={isCounselor}
          showThreadMobile={showThreadMobile}
          aliases={aliases}
          previews={previews}
          staffNames={staffNames}
          me={me}
          activeId={activeId}
          activeDm={activeDm}
          openThread={openThread}
          openDm={openDm}
          needsReply={needsReply}
          onNewMessage={openMessenger}
          threadCounts={threadCounts}
        />

        {/* Conversation */}
        <section
          aria-label={active ? `Chat with ${activeAlias}` : activeDm ? `Direct chat with ${activeDmName}` : "No chat selected"}
          className={`overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card lg:h-full lg:min-h-0 ${showThreadMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}
        >
          {!showing ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center bg-gradient-to-b from-white to-cream/40 px-6 py-12 text-center lg:min-h-0 lg:flex-1">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary-600 shadow-sm ring-1 ring-blue-100">
                <MessagesSquare className="h-8 w-8" aria-hidden />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-ink">Pick a conversation</p>
              <p className="mt-1 max-w-[360px] text-sm leading-relaxed text-ink-muted">
                {isFaculty
                  ? "Select a conversation from the list to read and reply. Use + to message a counselor or the guidance head about your referrals."
                  : isOffice
                    ? "Select a conversation from the list to read and reply. Use + to message a counselor directly."
                    : "Select a conversation from the list to read and reply. Use + to message faculty about their referrals. Threads open from student sessions — the amber dot marks ones waiting on a counselor."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/5">
                  <Clock className="h-3 w-3 text-primary-600" aria-hidden /> Live updates
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-ink/5">
                  <Inbox className="h-3 w-3 text-primary-600" aria-hidden /> Message history saved
                </span>
              </div>
            </div>
          ) : active ? (
            <>
              <div className="flex items-center gap-3 border-b border-ink/10 bg-gradient-to-b from-white to-cream/40 px-3.5 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setShowThreadMobile(false)}
                  aria-label="Back to conversations"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-soft transition hover:bg-white hover:text-ink lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
                <span className="relative shrink-0">
                  <span
                    aria-hidden
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-white shadow-sm ${
                      active.status === "open" ? avatarToneFor(activeAlias) : "from-slate-400 to-slate-500"
                    }`}
                  >
                    {initials(activeAlias)}
                  </span>
                  <span
                    aria-hidden
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${
                      active.status === "open" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[15px] font-bold text-ink">{activeAlias}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">
                    {activeCounselor} · {active.status === "open" ? "Open thread" : "Closed thread"}
                    {role === "guidance_head" && !iAmParticipant ? " · supervisory" : ""}
                  </p>
                </div>
                <Badge tone={active.status === "open" ? "success" : "info"}>
                  {active.status === "open" ? "Open" : "Closed"}
                </Badge>
              </div>

              <MessageList
                messages={messages}
                me={me}
                bottomRef={bottomRef}
                showJump={showJump}
                onScroll={onMessagesScroll}
                onJump={jumpToLatest}
                emptyText="No messages yet — say hello first."
                peerLabel={activeAlias}
                peerTone={avatarToneFor(activeAlias)}
                topSlot={
                  hasMoreHistory ? (
                    <button
                      type="button"
                      onClick={loadOlder}
                      disabled={loadingOlder}
                      className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-ink-soft shadow-sm ring-1 ring-ink/10 transition hover:text-ink disabled:opacity-50"
                    >
                      {loadingOlder ? "Loading…" : "Load older messages"}
                    </button>
                  ) : null
                }
              />

              {iAmParticipant ? (
                <Composer
                  draft={draft}
                  onDraftChange={setDraft}
                  sending={sending}
                  onSubmit={send}
                  placeholder="Reply…"
                  inputLabel="Reply"
                  sendLabel="Send reply"
                />
              ) : (
                <p className="flex items-start gap-2 border-t border-ink/10 bg-cream px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
                  <span>
                    Supervisory view — replies come from the assigned counselor ({activeCounselor}), so this
                    conversation is read-only for you.
                  </span>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-ink/10 bg-gradient-to-b from-white to-cream/40 px-3.5 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setShowThreadMobile(false)}
                  aria-label="Back to conversations"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-soft transition hover:bg-white hover:text-ink lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
                <span className="relative shrink-0">
                  <span
                    aria-hidden
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-white shadow-sm ${avatarToneFor(
                      activeDmName
                    )}`}
                  >
                    {initials(activeDmName)}
                  </span>
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white"
                  />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[15px] font-bold text-ink">{activeDmName}</p>
                  <p className="truncate text-xs font-medium text-ink-muted">Direct message · staff only</p>
                </div>
                <Badge tone="info">Direct</Badge>
              </div>

              <MessageList
                messages={dmHistory}
                me={me}
                bottomRef={bottomRef}
                showJump={showJump}
                onScroll={onMessagesScroll}
                onJump={jumpToLatest}
                peerLabel={activeDmName}
                peerTone={avatarToneFor(activeDmName)}
              />

              <Composer
                draft={draft}
                onDraftChange={setDraft}
                sending={sending}
                onSubmit={sendDm}
                placeholder="Write a message…"
                inputLabel="Write a message"
                sendLabel="Send message"
              />
            </>
          )}
        </section>
      </div>

      <NewMessageModal
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        counselor={msgCounselor}
        onCounselorChange={setMsgCounselor}
        body={msgBody}
        onBodyChange={setMsgBody}
        busy={msgBusy}
        onSend={sendToCounselor}
        counselorNames={counselorNames}
        openMenuKey={openMenuKey}
        onOpenMenuChange={setOpenMenuKey}
        title={isFaculty ? "Message the office" : isCounselor ? "Message faculty" : undefined}
        description={
          isFaculty
            ? "Ask about your referrals — a counselor or the head will reply here."
            : isCounselor
              ? "Coordinate with faculty about their referrals — replies land here."
              : undefined
        }
        options={isFaculty || isCounselor ? contactOptions : undefined}
        pickerLabel={isFaculty ? "Choose who to message" : isCounselor ? "Choose faculty" : undefined}
      />
    </div>
  );
}
