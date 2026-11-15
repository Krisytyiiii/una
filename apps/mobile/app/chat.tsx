import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import SearchIcon from 'lucide-react-native/icons/search';
import X from 'lucide-react-native/icons/x';
import Lock from 'lucide-react-native/icons/lock';
import Sparkles from 'lucide-react-native/icons/sparkles';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import {
  getThreadWithMessages,
  listStudentAppointments,
  listThreads,
  markNotificationsRead,
  messageableCounselors,
  openThread as openChatThread,
  sendMessage,
  type MessageableCounselor,
} from '@dorsu/shared-services';
import type { AppointmentRow, ChatMessageRow, ChatThreadRow } from '@dorsu/shared-types';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
  sizes,
  hitSlop,
  cardShadow,
} from '@/theme';
import { IconButton } from '@/components/IconButton';
import { Button } from '@/components/Button';
import { ChatBubble } from '@/components/ChatBubble';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { Composer } from '@/components/chat/Composer';
import { ConversationCard } from '@/components/chat/ConversationCard';
import { PressableScale } from '@/components/PressableScale';
import { LumiFigure } from '@/components/mascot/Lumi';
import { TabBar, TAB_BAR_BASE } from '@/components/TabBar';
import { getSupabase } from '@/lib/supabase/client';
import { loadCounselorDirectory } from '@/lib/counselors';
import { errorMessage } from '@/lib/errors';
import { useNotificationCount } from '@/lib/notifications-context';

type Me = { profileId: string; studentId: string; alias: string };
type ChatView = 'list' | 'thread';

/** One inbox row: a messageable counselor, or a leftover/closed thread. */
type InboxCard = {
  key: string;
  name: string;
  subtitle: string;
  preview: string;
  mine: boolean;
  time: string;
  unread: boolean;
  closed: boolean;
  sortAt: number;
  thread?: ChatThreadRow;
  counselor?: MessageableCounselor;
};

const QUICK_REPLIES = ['Thank you', 'I need to talk', 'How do I reschedule?'];

// Supabase caches realtime channels by topic. If an effect re-runs (or React
// StrictMode double-invokes it) before the previous `removeChannel` settles,
// `channel(topic)` hands back the already-subscribed instance and adding
// postgres_changes throws. A process-wide sequence keeps every setup on a
// fresh topic, matching the notifications provider (00024 realtime).
let chatChannelSeq = 0;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Today" / "Yesterday" / "Mon, Oct 20" — date separators inside a dialog. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * Inbox timestamp: time today, "Yesterday", weekday within the last week,
 * then the date (year only when it differs). Mirrors how mail/messaging apps
 * keep the right-hand column scannable.
 */
function listStamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDiff <= 0) return timeOf(iso);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString(
    'en-US',
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

/**
 * Student <-> Guidance chat, backed by `chat_threads` / `chat_messages`.
 *
 * Two levels: the inbox lists the counselors from the student's confirmed (or
 * completed) sessions plus any leftover conversations; tapping one opens the
 * dialog. Counselors are the entry point because a thread with
 * `counselor_id = null` is invisible to every staff inbox (00037 participant
 * policy + the web board filters by counselor id). Selecting a counselor
 * lazily calls `openThread({ counselorId })`, which reuses the existing open
 * thread. Back from a dialog returns to the inbox, and back from the inbox
 * leaves the screen. The screen follows the RLS model: a student can only
 * open a thread for their own `students.id` and send as their own profile.
 * Messages arrive through the published `chat_messages` table (00024);
 * inserts are optimistic-deduped by id so the realtime echo and the send
 * response never double-render.
 */
export default function Chat() {
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<ChatView>('list');
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, ChatMessageRow>>({});
  const [thread, setThread] = useState<ChatThreadRow | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [counselorSpecialties, setCounselorSpecialties] = useState<Record<string, string>>({});
  const [sessionCounselors, setSessionCounselors] = useState<MessageableCounselor[]>([]);
  const [awaitingCounselor, setAwaitingCounselor] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [startingFor, setStartingFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // Threads opened this visit. Used for the inbox "new reply" treatment; the
  // OS notification badge remains the cross-launch signal.
  const [seen, setSeen] = useState<Record<string, true>>({});
  const [bannerOpen, setBannerOpen] = useState(true);
  // Scroll awareness for the "jump to latest" affordance. The button only
  // appears after the reader drags away from the bottom, so programmatic
  // auto-scrolls on open/send never flash it.
  const [atBottom, setAtBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const [awayCount, setAwayCount] = useState(0);
  const stickToBottom = useRef(true);
  const list = useRef<FlatList<ChatMessageRow> | null>(null);
  const { refresh: refreshUnread } = useNotificationCount();

  const scrollEnd = () => {
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);
  };

  const loadInbox = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please log in again to use messages.');
        return;
      }

      const { data: studentRow } = await supabase
        .from('students')
        .select('id, anonymous_alias')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (!studentRow) {
        setError('Your student profile is still being set up. Pull back and try again.');
        return;
      }

      const found: Me = {
        profileId: user.id,
        studentId: studentRow.id,
        alias: studentRow.anonymous_alias ?? 'your alias',
      };
      setMe(found);

      const [rows, directory, appointments] = await Promise.all([
        listThreads(supabase, found.studentId) as Promise<ChatThreadRow[]>,
        loadCounselorDirectory(supabase),
        listStudentAppointments(supabase, found.studentId),
      ]);
      // Heads can own a `counselors` row but are not chat participants
      // (00037/00060): the staff board never lists student threads for them,
      // so a thread bound to a head would go unanswered. Hide both the contact
      // card and any leftover thread bound to one.
      const headCounselorIds = new Set(
        Object.entries(directory.roles)
          .filter(([, role]) => role === 'guidance_head')
          .map(([counselorId]) => counselorId),
      );
      const visibleThreads = rows.filter(
        (t) => !t.counselor_id || !headCounselorIds.has(t.counselor_id),
      );
      setThreads(visibleThreads);
      setCounselorNames(directory.names);
      setCounselorSpecialties(directory.specialties);
      // Confirmed + completed sessions are the only counselors a student may
      // message; one contact per counselor regardless of session count.
      const appts = (appointments ?? []) as AppointmentRow[];
      setSessionCounselors(
        messageableCounselors(appts).filter((c) => !headCounselorIds.has(c.counselorId)),
      );
      // A booked-but-unconfirmed request has no counselor yet, so the empty
      // state should point at Sessions rather than asking them to book again.
      setAwaitingCounselor(
        appts.some((a) => a.status === 'pending' || a.status === 'assigned'),
      );

      // One bounded read per conversation for the "last message" preview.
      // Students keep a handful of threads, so N small reads stay cheap.
      const latest = await Promise.all(
        visibleThreads.slice(0, 20).map(async (t) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('id, thread_id, sender_profile_id, body, created_at')
            .eq('thread_id', t.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return [t.id, data as ChatMessageRow | null] as const;
        }),
      );
      const next: Record<string, ChatMessageRow> = {};
      for (const [id, row] of latest) {
        if (row) next[id] = row;
      }
      setPreviews(next);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load your messages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const refreshInbox = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInbox();
    } finally {
      setRefreshing(false);
    }
  }, [loadInbox]);

  const threadId = thread?.id ?? null;

  // Live replies for the open thread. Server rows are deduped by id against
  // the optimistic send result.
  useEffect(() => {
    if (!threadId) return;
    const supabase = getSupabase();
    const topic = `mobile-chat-${threadId}-${Date.now()}-${++chatChannelSeq}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          setPreviews((prev) => ({ ...prev, [threadId]: row }));
          // Only nudge when the reader has scrolled away from the newest
          // message — otherwise the list already follows the conversation.
          if (!stickToBottom.current) setAwayCount((count) => count + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  const clearChatNotifications = async (profileId: string) => {
    try {
      const supabase = getSupabase();
      const { data: unread } = await supabase
        .from('notifications')
        .select('id')
        .eq('profile_id', profileId)
        .eq('type', 'chat')
        .eq('is_read', false);
      const ids = ((unread ?? []) as { id: string }[]).map((n) => n.id);
      if (ids.length > 0) {
        await markNotificationsRead(supabase, ids);
        void refreshUnread();
      }
    } catch {
      // Badge cleanup is best-effort; the conversation still works.
    }
  };

  const markSeen = (id: string) =>
    setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));

  const resetThreadExtras = useCallback(() => {
    setBannerOpen(true);
    setAtBottom(true);
    setUserScrolled(false);
    setAwayCount(0);
    stickToBottom.current = true;
  }, []);

  const openConversation = async (row: ChatThreadRow) => {
    setView('thread');
    setThread(row);
    setMessages([]);
    setDraft('');
    setError('');
    setOpening(true);
    resetThreadExtras();
    markSeen(row.id);
    try {
      const supabase = getSupabase();
      const detail = await getThreadWithMessages(supabase, row.id);
      setThread(detail.thread as ChatThreadRow);
      setMessages((detail.messages ?? []) as ChatMessageRow[]);
      if (me) void clearChatNotifications(me.profileId);
    } catch (e) {
      setError(errorMessage(e, 'Could not open this conversation.'));
    } finally {
      setOpening(false);
    }
  };

  /**
   * Tapping a counselor card. Reuses the open thread when one exists;
   * otherwise creates one bound to that counselor so the staff inbox can
   * actually see it (00037 keeps threads participant-only).
   */
  const openWithCounselor = async (entry: MessageableCounselor) => {
    if (!me || opening) return;
    const existing = threads.find(
      (t) => t.status === 'open' && t.counselor_id === entry.counselorId,
    );
    if (existing) {
      await openConversation(existing);
      return;
    }
    setView('thread');
    setThread(null);
    setMessages([]);
    setDraft('');
    setError('');
    setOpening(true);
    resetThreadExtras();
    setStartingFor(entry.counselorId);
    try {
      const supabase = getSupabase();
      const created = (await openChatThread(supabase, {
        studentId: me.studentId,
        counselorId: entry.counselorId,
      })) as ChatThreadRow;
      setThread(created);
      markSeen(created.id);
      setThreads((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev.map((t) => (t.id === created.id ? created : t))
          : [created, ...prev],
      );
      // A dedupe hit can return a thread that already has history.
      const detail = await getThreadWithMessages(supabase, created.id);
      setThread(detail.thread as ChatThreadRow);
      setMessages((detail.messages ?? []) as ChatMessageRow[]);
      void clearChatNotifications(me.profileId);
    } catch (e) {
      // Stay on the inbox so the retry banner is visible.
      setView('list');
      setThread(null);
      setError(errorMessage(e, 'Could not start that conversation. Please try again.'));
    } finally {
      setStartingFor(null);
      setOpening(false);
    }
  };

  const backToList = useCallback(() => {
    setView('list');
    setThread(null);
    setMessages([]);
    setDraft('');
    setError('');
    resetThreadExtras();
    void loadInbox();
  }, [loadInbox, resetThreadExtras]);

  const handleBack = () => {
    if (view === 'thread') {
      backToList();
      return;
    }
    router.back();
  };

  // Android hardware back follows the same two-level flow instead of
  // popping the whole chat route while a dialog is open.
  useEffect(() => {
    if (view !== 'thread') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backToList();
      return true;
    });
    return () => sub.remove();
  }, [view, backToList]);

  const send = async (text: string) => {
    const body = text.trim();
    if (body === '' || !me || !thread || sending || thread.status === 'closed') return;
    setSending(true);
    setError('');
    try {
      const supabase = getSupabase();
      const sent = (await sendMessage(supabase, {
        threadId: thread.id,
        senderProfileId: me.profileId,
        body,
      })) as ChatMessageRow;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setPreviews((prev) => ({ ...prev, [thread.id]: sent }));
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, updated_at: sent.created_at } : t)),
      );
      setDraft('');
      // Sending always returns the reader to the live end of the thread.
      stickToBottom.current = true;
      setAtBottom(true);
      setUserScrolled(false);
      setAwayCount(0);
      scrollEnd();
    } catch (e) {
      setError(errorMessage(e, 'Could not send your message. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const counselorName = thread?.counselor_id ? counselorNames[thread.counselor_id] : undefined;
  const who = counselorName ?? (thread?.counselor_id ? 'Counselor' : 'Guidance Office');
  const whoSpecialty = thread?.counselor_id
    ? counselorSpecialties[thread.counselor_id]
    : undefined;
  const closed = thread?.status === 'closed';

  // One card per messageable counselor, then leftover/closed conversations.
  // Open threads for a counselor are folded into that counselor's card so the
  // same conversation never appears twice.
  const inboxCards = useMemo<InboxCard[]>(() => {
    const cards: InboxCard[] = [];

    for (const entry of sessionCounselors) {
      const openThread = threads.find(
        (t) => t.status === 'open' && t.counselor_id === entry.counselorId,
      );
      const preview = openThread ? previews[openThread.id] : undefined;
      const stamp = preview?.created_at ?? openThread?.updated_at ?? entry.scheduledAt;
      cards.push({
        key: `counselor-${entry.counselorId}`,
        name: counselorNames[entry.counselorId] ?? 'Counselor',
        subtitle: counselorSpecialties[entry.counselorId] ?? 'Guidance counselor',
        preview: preview?.body ?? 'No messages yet — say hello',
        mine: preview?.sender_profile_id === me?.profileId,
        time: listStamp(stamp),
        unread:
          openThread !== undefined &&
          preview !== undefined &&
          preview.sender_profile_id !== me?.profileId &&
          !seen[openThread.id],
        closed: false,
        sortAt: new Date(stamp).getTime(),
        thread: openThread,
        counselor: entry,
      });
    }

    const claimedThreadIds = new Set(
      cards
        .map((card) => card.thread?.id)
        .filter((id): id is string => typeof id === 'string'),
    );

    for (const item of threads.filter((t) => !claimedThreadIds.has(t.id))) {
      const preview = previews[item.id];
      const stamp = preview?.created_at ?? item.updated_at;
      cards.push({
        key: `thread-${item.id}`,
        name: item.counselor_id
          ? counselorNames[item.counselor_id] ?? 'Counselor'
          : 'Guidance Office',
        subtitle: item.status === 'closed' ? 'Previous conversation' : 'Conversation',
        preview: preview?.body ?? 'No messages yet',
        mine: preview?.sender_profile_id === me?.profileId,
        time: listStamp(stamp),
        unread:
          item.status === 'open' &&
          preview !== undefined &&
          preview.sender_profile_id !== me?.profileId &&
          !seen[item.id],
        closed: item.status === 'closed',
        sortAt: new Date(stamp).getTime(),
        thread: item,
      });
    }

    // Unread first, then most recent activity.
    return cards.sort(
      (a, b) => Number(b.unread) - Number(a.unread) || b.sortAt - a.sortAt,
    );
  }, [
    counselorNames,
    counselorSpecialties,
    me?.profileId,
    previews,
    seen,
    sessionCounselors,
    threads,
  ]);

  const query = search.trim().toLowerCase();
  const visibleCards =
    query === ''
      ? inboxCards
      : inboxCards.filter((card) =>
          `${card.name} ${card.subtitle} ${card.preview}`.toLowerCase().includes(query),
        );
  const counselorCards = visibleCards.filter((card) => card.counselor !== undefined);
  const otherCards = visibleCards.filter((card) => card.counselor === undefined);
  const unreadTotal = inboxCards.filter((card) => card.unread).length;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nearBottom = distance < 140;
    stickToBottom.current = nearBottom;
    if (nearBottom !== atBottom) setAtBottom(nearBottom);
    if (nearBottom && awayCount !== 0) setAwayCount(0);
  };

  const jumpToLatest = () => {
    stickToBottom.current = true;
    setAtBottom(true);
    setUserScrolled(false);
    setAwayCount(0);
    list.current?.scrollToEnd({ animated: true });
  };

  const renderInboxCard = (card: InboxCard) => (
    <ConversationCard
      key={card.key}
      name={card.name}
      subtitle={card.subtitle}
      preview={card.preview}
      previewPrefix={card.mine ? 'You: ' : undefined}
      time={card.time}
      unread={card.unread}
      closed={card.closed}
      busy={
        card.counselor !== undefined &&
        startingFor === card.counselor.counselorId
      }
      accessibilityHint={
        card.counselor
          ? counselorSpecialties[card.counselor.counselorId] ?? 'Guidance counselor'
          : undefined
      }
      onPress={() => {
        if (card.counselor) void openWithCounselor(card.counselor);
        else if (card.thread) void openConversation(card.thread);
      }}
    />
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        {view === 'list' ? (
          <View style={styles.flex}>
            <View style={styles.hero}>
              <View pointerEvents="none" style={styles.heroSun} />
              <View pointerEvents="none" style={styles.heroSky} />

              <View style={styles.heroTop}>
                <View style={styles.flex}>
                  <Text style={styles.heroEyebrow}>GUIDANCE OFFICE</Text>
                  <Text style={styles.heroTitle}>Messages</Text>
                </View>
                <View style={styles.privatePill}>
                  <Lock size={11} color={colors.ink} />
                  <Text style={styles.privatePillText}>Private</Text>
                </View>
              </View>

              <Text style={styles.heroSub}>
                Talk with the counselor who knows you — under your alias.
              </Text>

              {unreadTotal > 0 ? (
                <View style={styles.unreadPill}>
                  <View style={styles.unreadDot} />
                  <Text style={styles.unreadPillText}>
                    {unreadTotal} new {unreadTotal === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.searchWrap}>
              <SearchIcon size={15} color={colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search counselors or messages"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel="Search conversations"
                autoCorrect={false}
              />
              {search !== '' ? (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={styles.searchClear}
                >
                  <X size={11} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.blue} />
                <Text style={styles.helper}>Loading your conversations…</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void refreshInbox()}
                    tintColor={colors.blue}
                    colors={[colors.blue]}
                  />
                }
                contentContainerStyle={[
                  styles.inbox,
                  visibleCards.length === 0 && styles.inboxEmpty,
                ]}
              >
                {error !== '' ? (
                  <View style={styles.errorCard}>
                    <Text style={styles.errText}>{error}</Text>
                    <Button
                      label="Retry"
                      variant="outline"
                      onPress={() => {
                        setError('');
                        void loadInbox();
                      }}
                    />
                  </View>
                ) : null}

                {query !== '' && visibleCards.length === 0 ? (
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <SearchIcon size={24} color={colors.blue} />
                    </View>
                    <Text style={styles.emptyTitle}>No matches</Text>
                    <Text style={styles.emptyText}>
                      Nothing here matches “{search.trim()}”. Try another name.
                    </Text>
                    <Button label="Clear search" variant="outline" onPress={() => setSearch('')} />
                  </View>
                ) : null}

                {counselorCards.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHead}>
                      <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionEyebrow}>YOUR CARE TEAM</Text>
                        <View style={styles.sectionCount}>
                          <Text style={styles.sectionCountText}>{counselorCards.length}</Text>
                        </View>
                      </View>
                      <Text style={styles.sectionHint}>From your confirmed sessions</Text>
                    </View>
                    {counselorCards.map(renderInboxCard)}
                  </View>
                ) : null}

                {otherCards.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHead}>
                      <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionEyebrow}>CONVERSATIONS</Text>
                        <View style={styles.sectionCount}>
                          <Text style={styles.sectionCountText}>{otherCards.length}</Text>
                        </View>
                      </View>
                      <Text style={styles.sectionHint}>Ongoing and previous chats</Text>
                    </View>
                    {otherCards.map(renderInboxCard)}
                  </View>
                ) : null}

                {inboxCards.length === 0 && error === '' ? (
                  <View style={styles.empty}>
                    <View style={styles.emptyIconLumi}>
                      <LumiFigure look={4} feel="happy" size={64} />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {awaitingCounselor
                        ? 'Waiting for confirmation'
                        : 'No counselors to message yet'}
                    </Text>
                    <Text style={styles.emptyText}>
                      {awaitingCounselor
                        ? 'Your session request is with the Guidance Office. Once a counselor confirms it, they appear here.'
                        : 'Once a counselor confirms your session, they show up here and you can chat privately.'}
                    </Text>
                    {awaitingCounselor ? (
                      <Button
                        label="View my sessions"
                        onPress={() => router.push('/(tabs)/sessions')}
                      />
                    ) : (
                      <Button label="Book a session" onPress={() => router.push('/book')} />
                    )}
                  </View>
                ) : null}

                <View style={styles.inboxFooter}>
                  <MessageCircle size={12} color={colors.muted} />
                  <Text style={styles.inboxFooterText}>
                    Only you and your counselor can read these messages.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={styles.flex}>
            <View style={styles.threadHeader}>
              <View pointerEvents="none" style={styles.threadSun} />
              <View style={styles.threadHeaderRow}>
                <IconButton
                  tone="plain"
                  label="Back to conversations"
                  onPress={handleBack}
                  style={styles.backBtn}
                >
                  <ArrowLeft size={sizes.tabIcon} color={colors.ink} />
                </IconButton>

                <InitialsAvatar name={who} size={40} />

                <View style={styles.who}>
                  <Text style={styles.whoName} numberOfLines={1}>
                    {who}
                  </Text>
                  <View style={styles.whoStatusRow}>
                    <View style={[styles.statusDot, closed && styles.statusDotClosed]} />
                    <Text style={styles.whoSub} numberOfLines={1}>
                      {opening
                        ? 'Opening conversation…'
                        : closed
                          ? 'Conversation closed'
                          : whoSpecialty ?? 'Private conversation'}
                    </Text>
                  </View>
                </View>

                <View style={styles.securePill}>
                  <Lock size={10} color={colors.blue} />
                  <Text style={styles.secureText}>Secure</Text>
                </View>
              </View>
            </View>

            <KeyboardAvoidingView
              style={styles.threadBody}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              {bannerOpen ? (
                <View style={styles.privacyBanner}>
                  <ShieldCheck size={15} color={colors.ink} />
                  <Text style={styles.privacyText}>
                    Chatting as <Text style={styles.privacyAlias}>{me?.alias ?? 'your alias'}</Text>.
                    Your name stays hidden unless safety requires it.
                  </Text>
                  <Pressable
                    onPress={() => setBannerOpen(false)}
                    hitSlop={hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss privacy notice"
                  >
                    <X size={13} color={colors.muted} />
                  </Pressable>
                </View>
              ) : null}

              {opening ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.blue} />
                  <Text style={styles.helper}>Opening conversation…</Text>
                </View>
              ) : (
                <View style={styles.listWrap}>
                  <FlatList
                    ref={list}
                    data={messages}
                    keyExtractor={(m) => m.id}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    onScroll={handleScroll}
                    onScrollBeginDrag={() => setUserScrolled(true)}
                    scrollEventThrottle={32}
                    contentContainerStyle={[
                      styles.list,
                      messages.length === 0 && styles.listEmpty,
                    ]}
                    onContentSizeChange={() => {
                      if (stickToBottom.current) scrollEnd();
                    }}
                    renderItem={({ item, index }) => {
                      const previous = index > 0 ? messages[index - 1] : undefined;
                      const next = index < messages.length - 1 ? messages[index + 1] : undefined;
                      const mine = item.sender_profile_id === me?.profileId;
                      const showDay =
                        !previous || !sameDay(previous.created_at, item.created_at);
                      const startsRun =
                        !previous ||
                        previous.sender_profile_id !== item.sender_profile_id ||
                        !sameDay(previous.created_at, item.created_at);
                      const endsRun =
                        !next ||
                        next.sender_profile_id !== item.sender_profile_id ||
                        !sameDay(next.created_at, item.created_at);
                      return (
                        <View>
                          {showDay ? (
                            <View style={styles.dayRow}>
                              <View style={styles.dayPill}>
                                <Text style={styles.dayText}>
                                  {dayLabel(item.created_at).toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          ) : null}
                          <ChatBubble
                            mine={mine}
                            text={item.body}
                            time={timeOf(item.created_at)}
                            first={startsRun}
                            last={endsRun}
                            avatar={mine ? undefined : <InitialsAvatar name={who} size={24} />}
                          />
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      <View style={styles.emptyThread}>
                        <View style={styles.emptyIconLumi}>
                          <LumiFigure look={4} feel="happy" size={64} />
                        </View>
                        <Text style={styles.emptyTitle}>Say hello</Text>
                        <Text style={styles.emptyText}>
                          This thread is only visible to you and {who}. Introduce yourself
                          whenever you are ready — no rush.
                        </Text>
                      </View>
                    }
                    ListFooterComponent={
                      messages.length > 0 ? (
                        <View style={styles.threadFooter}>
                          <Lock size={11} color={colors.muted} />
                          <Text style={styles.threadFooterText}>
                            Private thread · only you and {who}
                          </Text>
                        </View>
                      ) : undefined
                    }
                  />

                  {userScrolled && !atBottom ? (
                    <PressableScale
                      onPress={jumpToLatest}
                      scaleTo={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={
                        awayCount > 0
                          ? `Jump to latest, ${awayCount} new messages`
                          : 'Jump to latest message'
                      }
                      style={styles.jump}
                    >
                      <ArrowDown size={16} color={colors.ink} />
                      {awayCount > 0 ? (
                        <View style={styles.jumpBadge}>
                          <Text style={styles.jumpBadgeText}>
                            {awayCount > 9 ? '9+' : awayCount}
                          </Text>
                        </View>
                      ) : null}
                    </PressableScale>
                  ) : null}
                </View>
              )}

              {error !== '' ? (
                <View style={styles.errorRow}>
                  <Text style={styles.errText}>{error}</Text>
                  <Button
                    label="Retry"
                    variant="outline"
                    onPress={() => {
                      setError('');
                      if (thread) void openConversation(thread);
                      else void loadInbox();
                    }}
                  />
                </View>
              ) : null}

              {closed ? (
                <View style={styles.closedCard}>
                  <View style={styles.closedIcon}>
                    <Lock size={15} color={colors.muted} />
                  </View>
                  <Text style={styles.closedText}>
                    This conversation is closed. Pick your counselor from Messages to start a new
                    one.
                  </Text>
                  <Button label="Back to messages" onPress={backToList} />
                </View>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.quickRow}
                    contentContainerStyle={styles.quickContent}
                  >
                    {QUICK_REPLIES.map((q) => (
                      <PressableScale
                        key={q}
                        onPress={() => void send(q)}
                        disabled={sending}
                        scaleTo={0.96}
                        accessibilityRole="button"
                        accessibilityLabel={`Send “${q}”`}
                        accessibilityState={{ disabled: sending }}
                        style={[styles.quickChip, sending && styles.quickChipOff]}
                      >
                        <Sparkles size={11} color={colors.blue} />
                        <Text style={styles.quickText}>{q}</Text>
                      </PressableScale>
                    ))}
                  </ScrollView>

                  <Composer
                    value={draft}
                    onChangeText={setDraft}
                    onSend={() => void send(draft)}
                    sending={sending}
                  />
                </>
              )}
            </KeyboardAvoidingView>
          </View>
        )}
      </SafeAreaView>

      {/* Same bottom navbar as the tabs — chat is a root stack screen. */}
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },

  /* ------------------------------- inbox ------------------------------- */

  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  heroSun: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.sunSoft,
    opacity: 0.75,
  },
  heroSky: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.sky,
    opacity: 0.7,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 1.1,
    color: colors.muted,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  heroSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    maxWidth: '88%',
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius + 8,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...cardShadow,
  },
  privatePillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
  },
  unreadPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius + 8,
    backgroundColor: colors.sun,
  },
  unreadDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ink },
  unreadPillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inbox: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: TAB_BAR_BASE + spacing.lg,
  },
  inboxEmpty: { flexGrow: 1, justifyContent: 'center' },
  section: { marginTop: spacing.sm },
  sectionHead: { paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  sectionCount: {
    minWidth: 18,
    borderRadius: radius + 6,
    backgroundColor: colors.sky,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
  },
  sectionHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  inboxFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  inboxFooterText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  helper: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  emptyThread: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconLumi: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: fontSize.sm + 5,
  },
  errorCard: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.danger,
  },

  /* ------------------------------ thread ------------------------------- */

  threadHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  threadSun: {
    position: 'absolute',
    top: -110,
    right: -50,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.sunSoft,
    opacity: 0.6,
  },
  threadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chip,
  },
  who: { flex: 1, gap: 1 },
  whoName: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  whoStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sun,
  },
  statusDotClosed: { backgroundColor: colors.muted },
  whoSub: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius + 6,
    backgroundColor: colors.sky,
  },
  secureText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
    letterSpacing: 0.3,
  },
  threadBody: {
    flex: 1,
    backgroundColor: colors.chip,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.sunSoft,
  },
  privacyText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.ink,
  },
  privacyAlias: { fontFamily: fontFamily.bold },
  listWrap: { flex: 1 },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  dayRow: { alignItems: 'center', paddingVertical: spacing.sm },
  dayPill: {
    backgroundColor: colors.white,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dayText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  threadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  threadFooterText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  jump: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.sm,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  jumpBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.white,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  closedCard: {
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: TAB_BAR_BASE + spacing.sm,
    ...cardShadow,
  },
  closedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.disabledBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: fontSize.sm + 5,
  },
  quickRow: {
    flexGrow: 0,
    marginTop: spacing.xs,
  },
  quickContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sky,
  },
  quickChipOff: { opacity: 0.5 },
  quickText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.blue,
  },
});
