import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CircleCheckBig from 'lucide-react-native/icons/circle-check-big';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Plus from 'lucide-react-native/icons/plus';
import { listStudentAppointments, preSessionPss10State, isWithinStudentRescheduleWindow, submitFeedback } from '@dorsu/shared-services';
import type { AppointmentRow } from '@dorsu/shared-types';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { loadCounselorDirectory } from '@/lib/counselors';
import { colors, fontFamily, fontSize, radius, spacing, cardShadow } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { type CheckinSummary, isPssBand } from '@/components/CheckinResult';
import { LumiFigure } from '@/components/mascot/Lumi';
import { PressableScale } from '@/components/PressableScale';
import { RescheduleModal } from '@/components/RescheduleModal';
import { SessionDetailsModal } from '@/components/SessionDetailsModal';
import { SessionCard } from '@/components/sessions/SessionCard';
import { SessionSkeleton } from '@/components/sessions/SessionSkeleton';
import { SessionTabs, type SessionTab } from '@/components/sessions/SessionTabs';
import { countdownLabel, dayParts } from '@/lib/session-format';
import { TAB_BAR_BASE } from '@/components/TabBar';

type Tab = SessionTab;

const ACTIVE = ['pending', 'assigned', 'confirmed'];

/** `listStudentAppointments` embeds the booking-gate assessment on each row. */
type LinkedPss = {
  total_score: number;
  band: string;
  created_at: string;
};

type StudentAppointment = AppointmentRow & {
  pss10?: LinkedPss | LinkedPss[] | null;
};

export default function Sessions() {
  const [tab, setTab] = useState<Tab>('Upcoming');
  const [rows, setRows] = useState<AppointmentRow[] | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState(0);
  const [checkinByAppt, setCheckinByAppt] = useState<Record<string, string>>({});
  // Newest scored check-in per appointment, from either link:
  //   appointments.pss10_id  (assessment taken at booking)
  //   pss10_assessments.appointment_id (pre-session check-in, retakes allowed)
  const [resultByAppt, setResultByAppt] = useState<Record<string, CheckinSummary>>({});
  const [rated, setRated] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [fbBusyId, setFbBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  // Counselor lookup for the details sheet. `counselor_directory()` is the
  // RLS-safe SECURITY DEFINER directory (00049); profiles are staff-only.
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [counselorSpecialties, setCounselorSpecialties] = useState<Record<string, string>>({});

  // Live read: own appointments + existing feedback + check-in count.
  // Re-runs on tab focus and on pull-to-refresh so staff-side changes
  // (assign/confirm/complete) appear without a re-login.
  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setRows([]);
        setError('Please log in again to see your sessions.');
        return;
      }
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (!student) {
        setRows([]);
        setError('Your student profile is still being set up. Pull down to refresh.');
        return;
      }
      const sid = student.id;
      const [appts, feedbackRes, pssRes, directory] = await Promise.all([
        listStudentAppointments(supabase, sid),
        supabase.from('feedback').select('appointment_id, rating').eq('student_id', sid),
        supabase
          .from('pss10_assessments')
          .select('id, appointment_id, created_at, total_score, band', { count: 'exact' })
          .eq('student_id', sid)
          .order('created_at', { ascending: false }),
        // Best-effort: sessions must still render if the directory lookup fails.
        loadCounselorDirectory(supabase),
      ]);
      const feedbackMap: Record<string, number> = {};
      for (const f of (feedbackRes.data ?? []) as { appointment_id: string; rating: number }[]) {
        feedbackMap[f.appointment_id] = f.rating;
      }
      // Newest linked check-in per appointment (retakes allowed since 00068).
      // The query is ordered newest-first, so the first row wins.
      const pssRows = (pssRes.data ?? []) as {
        appointment_id: string | null;
        created_at: string;
        total_score: number | null;
        band: string | null;
      }[];
      const checkinMap: Record<string, string> = {};
      const resultMap: Record<string, CheckinSummary> = {};
      for (const p of pssRows) {
        if (!p.appointment_id) continue;
        if (!checkinMap[p.appointment_id]) checkinMap[p.appointment_id] = p.created_at;
        if (
          !resultMap[p.appointment_id] &&
          isPssBand(p.band) &&
          typeof p.total_score === 'number'
        ) {
          resultMap[p.appointment_id] = {
            at: p.created_at,
            totalScore: p.total_score,
            band: p.band,
          };
        }
      }

      const appointmentRows = (appts ?? []) as StudentAppointment[];
      // The assessment taken at booking hangs off appointments.pss10_id rather
      // than appointment_id, so merge it in and keep whichever is newer.
      for (const a of appointmentRows) {
        const linked = Array.isArray(a.pss10) ? a.pss10[0] : a.pss10;
        if (!linked || !isPssBand(linked.band) || typeof linked.total_score !== 'number') {
          continue;
        }
        const existing = resultMap[a.id];
        if (
          existing &&
          new Date(existing.at).getTime() >= new Date(linked.created_at).getTime()
        ) {
          continue;
        }
        resultMap[a.id] = {
          at: linked.created_at,
          totalScore: linked.total_score,
          band: linked.band,
        };
      }

      setStudentId(sid);
      setRows(appointmentRows);
      setRated(feedbackMap);
      setCheckins(pssRes.count ?? 0);
      setCheckinByAppt(checkinMap);
      setResultByAppt(resultMap);
      setCounselorNames(directory.names);
      setCounselorSpecialties(directory.specialties);
      setError('');
    } catch (e) {
      setRows((prev) => prev ?? []);
      setError(errorMessage(e, 'Could not load your sessions.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { upcoming, past, canceled } = useMemo(() => {
    // `new Date()` is allowed by the purity lint (Date.now is not); grouping
    // refreshes whenever the row set changes or the screen regains focus.
    const now = new Date().getTime();
    const all = rows ?? [];
    const isActive = (r: AppointmentRow) => ACTIVE.includes(r.status);
    const upcomingRows = all
      .filter((r) => isActive(r) && new Date(r.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const pastRows = all
      .filter(
        (r) =>
          r.status === 'completed' ||
          r.status === 'no_show' ||
          (isActive(r) && new Date(r.scheduled_at).getTime() < now),
      )
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    const canceledRows = all
      .filter((r) => r.status === 'cancelled' || r.status === 'rejected')
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    return { upcoming: upcomingRows, past: pastRows, canceled: canceledRows };
  }, [rows]);

  const completedCount = (rows ?? []).filter((r) => r.status === 'completed').length;
  const list = tab === 'Upcoming' ? upcoming : tab === 'Past' ? past : canceled;
  const tabCounts: Record<Tab, number> = {
    Upcoming: upcoming.length,
    Past: past.length,
    Canceled: canceled.length,
  };
  const loading = rows === null;
  const nowMs = new Date().getTime();
  const selected = openId === null ? null : (rows ?? []).find((r) => r.id === openId) ?? null;
  const selectedSpecialty = selected?.counselor_id
    ? counselorSpecialties[selected.counselor_id]
    : undefined;

  // Hero subtitle: the soonest session (or an invitation to book).
  const nextUp = upcoming[0];
  const heroSub = loading
    ? 'Loading your sessions…'
    : nextUp
      ? `Next session ${countdownLabel(nextUp.scheduled_at).toLowerCase()} · ${dayParts(nextUp.scheduled_at).time}`
      : 'Nothing scheduled — book whenever you are ready.';

  // Shared details/cancel/reschedule sheets: closing the details first keeps a
  // single modal on screen at a time.
  const requestCancel = (row: AppointmentRow) => {
    setOpenId(null);
    setCancelTarget(row);
  };

  const requestReschedule = (row: AppointmentRow) => {
    setOpenId(null);
    setRescheduleTarget(row);
  };

  const applyCancelled = (row: AppointmentRow) => {
    setRows((prev) =>
      prev?.map((r) => (r.id === row.id ? { ...r, status: 'cancelled' } : r)) ?? prev,
    );
    setCancelTarget(null);
  };

  const applyRescheduled = (updated: AppointmentRow) => {
    setRows((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
  };

  const sendFeedback = async (row: AppointmentRow) => {
    const rating = draft[row.id];
    if (!studentId || !rating) return;
    setFbBusyId(row.id);
    setError('');
    try {
      await submitFeedback(getSupabase(), {
        appointmentId: row.id,
        studentId,
        rating,
      });
      setRated((prev) => ({ ...prev, [row.id]: rating }));
    } catch (e) {
      setError(errorMessage(e, 'Could not send your rating.'));
    } finally {
      setFbBusyId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  };

  const emptyCopy =
    tab === 'Canceled'
      ? {
          title: 'No canceled sessions',
          body: 'Canceled requests will show up here.',
        }
      : tab === 'Past'
        ? {
            title: 'No past sessions yet',
            body: 'Completed sessions and your ratings appear here.',
          }
        : {
            title: 'No upcoming sessions',
            body: 'Book when you are ready. We are here.',
          };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.blue}
              colors={[colors.blue]}
            />
          }
        >
          <View style={styles.hero}>
            <View pointerEvents="none" style={styles.heroSun} />
            <View pointerEvents="none" style={styles.heroSky} />

            <View style={styles.heroTop}>
              <View style={styles.flex}>
                <Text style={styles.heroEyebrow}>YOUR CARE</Text>
                <Text style={styles.heroTitle}>My sessions</Text>
              </View>

              <PressableScale
                onPress={() => router.push('/book')}
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityLabel="Book a new session"
                style={styles.bookBtn}
              >
                <Plus size={14} color={colors.ink} strokeWidth={2.6} />
                <Text style={styles.bookText}>Book new</Text>
              </PressableScale>
            </View>

            <Text style={styles.heroSub}>{heroSub}</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.summary}>
              <Pressable
                onPress={() => setTab('Upcoming')}
                accessibilityRole="button"
                accessibilityLabel={`Upcoming sessions, ${upcoming.length}`}
                accessibilityState={{ selected: tab === 'Upcoming' }}
                style={({ pressed }) => [styles.summaryItem, pressed && styles.summaryPressed]}
              >
                <View style={[styles.summaryIcon, styles.summaryIconSky]}>
                  <CalendarDays size={15} color={colors.blue} />
                </View>
                <Text style={styles.summaryNum}>{loading ? '—' : upcoming.length}</Text>
                <Text style={styles.summaryLabel}>Upcoming</Text>
              </Pressable>

              <View style={styles.summaryDivider} />

              <Pressable
                onPress={() => setTab('Past')}
                accessibilityRole="button"
                accessibilityLabel={`Past sessions, ${completedCount} completed`}
                accessibilityState={{ selected: tab === 'Past' }}
                style={({ pressed }) => [styles.summaryItem, pressed && styles.summaryPressed]}
              >
                <View style={[styles.summaryIcon, styles.summaryIconSun]}>
                  <CircleCheckBig size={15} color={colors.ink} />
                </View>
                <Text style={styles.summaryNum}>{loading ? '—' : completedCount}</Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </Pressable>

              <View style={styles.summaryDivider} />

              <Pressable
                onPress={() => router.push('/check-in')}
                accessibilityRole="button"
                accessibilityLabel={`${checkins} stress check-ins, start a new one`}
                style={({ pressed }) => [styles.summaryItem, pressed && styles.summaryPressed]}
              >
                <View style={[styles.summaryIcon, styles.summaryIconChip]}>
                  <ClipboardList size={15} color={colors.blue} />
                </View>
                <Text style={styles.summaryNum}>{loading ? '—' : checkins}</Text>
                <Text style={styles.summaryLabel}>Check-ins</Text>
              </Pressable>
            </View>

            <SessionTabs
              active={tab}
              counts={tabCounts}
              loading={loading}
              onChange={setTab}
            />

            {error !== '' ? (
              <Card style={styles.errCard}>
                <Text style={styles.errText}>{error}</Text>
                <Button label="Try again" variant="outline" onPress={() => void load()} />
              </Card>
            ) : null}

            {loading ? (
              <SessionSkeleton />
            ) : list.length === 0 ? (
              <Card style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <LumiFigure look={4} feel="calm" size={64} />
                </View>
                <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
                <Text style={styles.emptySub}>{emptyCopy.body}</Text>
                {tab !== 'Canceled' ? (
                  <View style={styles.emptyAction}>
                    <Button label="Book a session" onPress={() => router.push('/book')} />
                  </View>
                ) : null}
              </Card>
            ) : (
              <>
                <View style={styles.listHead}>
                  <Text style={styles.listCaption}>
                    {tab === 'Upcoming'
                      ? 'Tap a session to view details and actions'
                      : 'Tap a session to view details'}
                  </Text>
                  <View style={styles.listCount}>
                    <Text style={styles.listCountText}>{list.length}</Text>
                  </View>
                </View>

                {list.map((a, index) => {
                  const isActive =
                    ACTIVE.includes(a.status) &&
                    new Date(a.scheduled_at).getTime() >= nowMs;
                  const checkinState = preSessionPss10State({
                    required: a.pss10_required,
                    waivedAt: a.pss10_waived_at,
                    scheduledAt: a.scheduled_at,
                    submittedAt: checkinByAppt[a.id] ?? null,
                  });
                  const canReschedule =
                    a.status === 'pending' ||
                    a.status === 'assigned' ||
                    (a.status === 'confirmed' &&
                      isActive &&
                      isWithinStudentRescheduleWindow(a.scheduled_at));

                  return (
                    <View key={a.id} style={styles.cardWrap}>
                      <SessionCard
                        appointment={a}
                        counselorName={
                          a.counselor_id ? counselorNames[a.counselor_id] : undefined
                        }
                        counselorSpecialty={
                          a.counselor_id
                            ? counselorSpecialties[a.counselor_id]
                            : undefined
                        }
                        checkinState={checkinState}
                        checkinAt={checkinByAppt[a.id]}
                        checkinResult={resultByAppt[a.id]}
                        rating={rated[a.id]}
                        draftRating={draft[a.id]}
                        ratingBusy={fbBusyId === a.id}
                        active={isActive}
                        canReschedule={canReschedule}
                        featured={tab === 'Upcoming' && index === 0}
                        onOpen={() => setOpenId(a.id)}
                        onReschedule={() => requestReschedule(a)}
                        onCancel={() => requestCancel(a)}
                        onCheckin={() =>
                          router.push({
                            pathname: '/check-in',
                            params: { appointmentId: a.id },
                          })
                        }
                        onMessage={() => router.push('/chat')}
                        onDraftRating={(value) =>
                          setDraft((d) => ({ ...d, [a.id]: value }))
                        }
                        onSubmitRating={() => void sendFeedback(a)}
                      />
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <SessionDetailsModal
        appointment={selected}
        cancelTarget={cancelTarget}
        counselorName={
          selected?.counselor_id ? counselorNames[selected.counselor_id] : undefined
        }
        counselorSpecialty={selectedSpecialty}
        checkinResult={selected ? resultByAppt[selected.id] : null}
        onClose={() => setOpenId(null)}
        onRequestReschedule={requestReschedule}
        onRequestCancel={requestCancel}
        onCancelClose={() => setCancelTarget(null)}
        onCancelled={applyCancelled}
        onMessage={() => {
          setOpenId(null);
          router.push('/chat');
        }}
      />

      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={applyRescheduled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: TAB_BAR_BASE + spacing.xl },
  flex: { flex: 1 },

  /* -------------------------------- hero -------------------------------- */

  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  heroSun: {
    position: 'absolute',
    top: -100,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.sunSoft,
    opacity: 0.75,
  },
  heroSky: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.sky,
    opacity: 0.65,
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
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.sun,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.creamLine,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bookText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },

  /* -------------------------------- body -------------------------------- */

  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    ...cardShadow,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  summaryPressed: { opacity: 0.55 },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 38,
    backgroundColor: colors.border,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  summaryIconSky: { backgroundColor: colors.sky },
  summaryIconSun: { backgroundColor: colors.sunSoft },
  summaryIconChip: { backgroundColor: colors.chip },
  summaryNum: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    color: colors.ink,
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  listCaption: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  listCount: {
    minWidth: 20,
    borderRadius: radius,
    backgroundColor: colors.chip,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    alignItems: 'center',
  },
  listCountText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  cardWrap: { marginBottom: spacing.sm },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: 20,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  emptySub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: fontSize.sm + 5,
  },
  emptyAction: { marginTop: spacing.xs },
  errCard: {
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  errText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
});
