import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import Bell from 'lucide-react-native/icons/bell';
import Megaphone from 'lucide-react-native/icons/megaphone';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Clock from 'lucide-react-native/icons/clock';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import Play from 'lucide-react-native/icons/play';
import X from 'lucide-react-native/icons/x';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  cardRadius,
  spacing,
  hitSlop,
  cardShadow,
  floatingShadow,
  glass,
} from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { CounselorPill } from '@/components/CounselorPill';
import { RescheduleModal } from '@/components/RescheduleModal';
import { SessionDetailsModal } from '@/components/SessionDetailsModal';
import { StatusChip } from '@/components/StatusChip';
import { MoodPicker, type MoodId } from '@/components/MoodPicker';
import { PressableScale } from '@/components/PressableScale';
import { TAB_BAR_BASE } from '@/components/TabBar';
import { LumiFigure } from '@/components/mascot/Lumi';
import { getSupabase } from '@/lib/supabase/client';
import { loadCounselorDirectory } from '@/lib/counselors';
import type { AppointmentRow } from '@dorsu/shared-types';
import { listStudentAppointments } from '@dorsu/shared-services';
import { useNotificationCount } from '@/lib/notifications-context';

const quick = [
  { id: 'book', title: 'Book a session', sub: 'Face-to-face, phone, online', Icon: CalendarDays, href: '/book' },
  { id: 'talk', title: 'Talk to us', sub: 'Anonymous chat', Icon: MessageCircle, href: '/chat' },
  { id: 'stress', title: 'Stress check', sub: '2-minute PSS check', Icon: ClipboardList, href: '/check-in' },
  { id: 'mine', title: 'My sessions', sub: 'Upcoming and past', Icon: Clock, href: '/(tabs)/sessions' },
] as const;

const ACTIVE_STATUSES = ['pending', 'assigned', 'confirmed'];

/** Lumi's spoken script — one line per 4-second breath phase, loops. */
const BREATH_SCRIPT = [
  'Breathe in… nice and slow.',
  'Breathe out… let it all go.',
  'Breathe in… feel your chest rise.',
  'Breathe out… drop your shoulders.',
  'Breathe in… fresh, calm air.',
  'Breathe out… worries drift away.',
  'Almost there… one more slow breath.',
  'And release… well done.',
] as const;

/**
 * Voice sync for breath-guide.mp3 (25.9s). Each entry is one script line:
 * `at` = start second, `len` = play seconds. Cut points were measured
 * from the recording's own pauses — every cut lands mid-silence with
 * 0.25s+ margin, and playback stops at the line end so the next line's
 * first word never leaks into the current message. Nudge a value if a
 * line ever sounds early/late against its message.
 */
const BREATH_LINES = [
  { at: 0, len: 2.94 }, // Breathe in… nice and slow.
  { at: 2.99, len: 3.39 }, // Breathe out… let it all go.
  { at: 6.43, len: 3.59 }, // Breathe in… feel your chest rise.
  { at: 10.07, len: 2.83 }, // Breathe out… drop your shoulders.
  { at: 12.95, len: 3.51 }, // Breathe in… fresh, calm air.
  { at: 16.51, len: 3.15 }, // Breathe out… worries drift away.
  { at: 19.71, len: 3.27 }, // Almost there… one more slow breath.
  { at: 23.03, len: 2.81 }, // And release… well done.
] as const;

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${weekday}, ${monthDay} · ${h}:${m} ${ampm}`;
}

function shortToday(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Home() {
  const [mood, setMood] = useState<MoodId | null>('okay');
  const [firstName, setFirstName] = useState('Student');
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()));
  const [next, setNext] = useState<AppointmentRow | null>(null);
  const { unread, refresh: refreshUnread } = useNotificationCount();
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [counselorSpecialties, setCounselorSpecialties] = useState<Record<string, string>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  const [breathOpen, setBreathOpen] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [scriptStep, setScriptStep] = useState(0);
  const scale = useRef(new Animated.Value(0.6)).current;
  const enterScale = useRef(new Animated.Value(0.92)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidePlayer = useAudioPlayer(require('@/assets/audio/breath-guide.mp3'));

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setGreeting(greetingForHour(new Date().getHours()));

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const fullName = (profile?.full_name ?? '').trim();
      if (fullName !== '') {
        const first = fullName.split(/\s+/)[0] ?? fullName;
        setFirstName(first);
      }

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (student) {
        const rows = (await listStudentAppointments(
          supabase,
          student.id,
        )) as AppointmentRow[];
        const upcoming = rows
          .filter(
            (a) =>
              ACTIVE_STATUSES.includes(a.status) &&
              new Date(a.scheduled_at).getTime() > Date.now(),
          )
          .sort(
            (a, b) =>
              new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
          )[0];
        setNext(upcoming ?? null);
        const directory = await loadCounselorDirectory(supabase);
        setCounselorNames(directory.names);
        setCounselorSpecialties(directory.specialties);
      }
    } catch {
      // Keep last-known (or empty) state on network failure.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshUnread();
    }, [load, refreshUnread]),
  );

  const stopBreath = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = null;
    guidePlayer.pause();
    guidePlayer.seekTo(0);
    setBreathOpen(false);
    setSeconds(60);
    setScriptStep(0);
    scale.setValue(0.6);
  };

  // Voice follows the message: every time the displayed line changes,
  // jump the recording to that line's timestamp, play exactly that line,
  // then pause so the next line never bleeds in early.
  useEffect(() => {
    if (!breathOpen) return;
    const line = BREATH_LINES[scriptStep % BREATH_LINES.length] ?? BREATH_LINES[0];
    if (!line) return;
    try {
      if (lineTimer.current) clearTimeout(lineTimer.current);
      guidePlayer.seekTo(line.at);
      guidePlayer.play();
      lineTimer.current = setTimeout(() => {
        guidePlayer.pause();
      }, Math.max(500, line.len * 1000));
    } catch {
      // Player not ready yet — the next line change retries.
    }
    return () => {
      if (lineTimer.current) {
        clearTimeout(lineTimer.current);
        lineTimer.current = null;
      }
    };
  }, [breathOpen, scriptStep, guidePlayer]);

  const startBreath = () => {
    setBreathOpen(true);
    setSeconds(60);
    setScriptStep(0);
    enterScale.setValue(0.92);
    enterOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(enterScale, {
        toValue: 1,
        damping: 16,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    const loop = (inhale: boolean, step: number) => {
      setScriptStep(step);
      Animated.timing(scale, {
        toValue: inhale ? 1 : 0.6,
        duration: 4000,
        useNativeDriver: true,
      }).start(() => {
        if (timer.current) loop(!inhale, step + 1);
      });
    };
    loop(true, 0);
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          guidePlayer.pause();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const modeLabel = next?.mode === 'online' ? 'Online' : 'Face-to-face';
  const nextMeta =
    next?.mode === 'online' ? `${modeLabel} · Video link` : `${modeLabel} · Guidance Office`;
  const canRescheduleNext =
    next !== null && (next.status === 'pending' || next.status === 'assigned');
  const progressPct = Math.max(0, Math.min(100, (seconds / 60) * 100));

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.blobSun} />
      <View pointerEvents="none" style={styles.blobSky} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.hello}>
              <Text style={styles.good}>
                {greeting} · {shortToday()}
              </Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <View style={styles.headerActions}>
              <PressableScale
                onPress={() => router.push('/announcements')}
                hitSlop={hitSlop}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel="Announcements"
                style={styles.bell}
              >
                <Megaphone size={19} color={colors.ink} />
              </PressableScale>
              <PressableScale
                onPress={() => router.push('/notifications')}
                hitSlop={hitSlop}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                style={styles.bell}
              >
                <Bell size={19} color={colors.ink} />
                {unread > 0 ? (
                  <View style={styles.bellBadge} pointerEvents="none">
                    <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </PressableScale>
            </View>
          </View>

          {next ? (
            <PressableScale
              onPress={() => setDetailsOpen(true)}
              scaleTo={0.985}
              accessibilityRole="button"
              accessibilityLabel="Open next session details"
              style={styles.next}
            >
              <View style={styles.nextClip} pointerEvents="none">
                <View style={styles.nextGlow} />
                <View style={styles.nextGlowSmall} />
              </View>

              <View style={styles.nextTop}>
                <View style={styles.nextEyebrowPill}>
                  <View style={styles.nextDot} />
                  <Text style={styles.nextEyebrow}>NEXT SESSION</Text>
                </View>
                <View style={styles.nextArrow}>
                  <ArrowUpRight size={16} color={colors.ink} />
                </View>
              </View>

              <Text style={styles.nextWhen}>{formatWhen(next.scheduled_at)}</Text>
              <Text style={styles.nextMeta}>{nextMeta}</Text>

              <View style={styles.nextPills}>
                <StatusChip status={next.status} />
                <CounselorPill
                  assigned={next.counselor_id !== null}
                  name={next.counselor_id ? counselorNames[next.counselor_id] : undefined}
                />
              </View>

              <View style={styles.nextBtns}>
                {canRescheduleNext ? (
                  <Button
                    label="Reschedule"
                    variant="outline"
                    onPress={() => {
                      setDetailsOpen(false);
                      setRescheduleTarget(next);
                    }}
                    style={styles.flex}
                  />
                ) : null}
                <Button
                  label="Cancel"
                  variant="dangerOutline"
                  onPress={() => {
                    setDetailsOpen(false);
                    setCancelTarget(next);
                  }}
                  style={styles.flex}
                />
              </View>
              {next.status === 'confirmed' ? (
                <Text style={styles.nextNote}>
                  Confirmed by your counselor — rescheduling is closed.
                </Text>
              ) : null}
            </PressableScale>
          ) : (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyRow}>
                <View style={styles.emptyMascot}>
                  <LumiFigure look={4} feel="happy" size={54} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>No upcoming sessions</Text>
                  <Text style={styles.cardSub}>Book when you are ready. We are here.</Text>
                </View>
              </View>
              <View style={styles.mt}>
                <Button label="Book a session" onPress={() => router.push('/book')} />
              </View>
            </Card>
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionEyebrow}>SHORTCUTS</Text>
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>

          <View style={styles.grid}>
            {quick.map(({ id, title, sub, Icon, href }) => (
              <PressableScale
                key={id}
                onPress={() => router.push(href)}
                scaleTo={0.96}
                accessibilityRole="button"
                accessibilityLabel={title}
                style={styles.tile}
              >
                <View style={styles.tileTop}>
                  <View style={styles.tileIcon}>
                    <Icon size={18} color={colors.blue} />
                  </View>
                  <ArrowUpRight size={14} color={colors.muted} />
                </View>
                <Text style={styles.tileTitle}>{title}</Text>
                <Text style={styles.tileSub}>{sub}</Text>
              </PressableScale>
            ))}
          </View>

          <Card style={styles.moodCard}>
            <Text style={styles.sectionEyebrow}>DAILY CHECK-IN</Text>
            <Text style={styles.cardTitle}>How are you feeling today?</Text>
            <Text style={styles.cardSub}>Only you can see this</Text>
            <View style={styles.moodWrap}>
              <MoodPicker value={mood} onChange={setMood} />
            </View>
          </Card>

          <PressableScale
            onPress={startBreath}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel="Start the 1-minute breathing exercise"
            style={styles.breath}
          >
            <View style={styles.breathClip} pointerEvents="none">
              <View style={styles.breathRing} />
            </View>
            <View style={styles.breathOrb}>
              <LumiFigure look={4} feel="calm" size={42} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.breathEyebrow}>TAKE A PAUSE</Text>
              <Text style={styles.breathTitle}>1-minute breathing</Text>
              <Text style={styles.breathSub}>Calm your mind before class.</Text>
            </View>
            <View style={styles.playBtn}>
              <Play size={15} color={colors.ink} fill={colors.ink} />
            </View>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>

      <SessionDetailsModal
        appointment={detailsOpen ? next : null}
        cancelTarget={cancelTarget}
        counselorName={next?.counselor_id ? counselorNames[next.counselor_id] : undefined}
        counselorSpecialty={
          next?.counselor_id ? counselorSpecialties[next.counselor_id] : undefined
        }
        onClose={() => setDetailsOpen(false)}
        onRequestReschedule={(appointment) => {
          setDetailsOpen(false);
          setRescheduleTarget(appointment);
        }}
        onRequestCancel={(appointment) => {
          setDetailsOpen(false);
          setCancelTarget(appointment);
        }}
        onCancelClose={() => setCancelTarget(null)}
        onCancelled={(appointment) =>
          setNext((cur) => (cur?.id === appointment.id ? null : cur))
        }
        onMessage={() => {
          setDetailsOpen(false);
          router.push('/chat');
        }}
      />

      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={(updated) =>
          setNext((cur) => (cur?.id === updated.id ? updated : cur))
        }
      />

      <Modal
        visible={breathOpen}
        transparent
        animationType="fade"
        onRequestClose={stopBreath}
        statusBarTranslucent
      >
        <View style={styles.breathModalBg} accessibilityViewIsModal>
          <Animated.View
            style={[
              styles.breathModal,
              { opacity: enterOpacity, transform: [{ scale: enterScale }] },
            ]}
          >
            <Pressable
              onPress={stopBreath}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Stop breathing exercise"
              style={styles.breathClose}
            >
              <X size={16} color={colors.muted} />
            </Pressable>

            <Text style={styles.breathModalEyebrow}>1-MINUTE BREATH</Text>
            <View style={styles.breathStage}>
              <View style={styles.breathStageRing} pointerEvents="none" />
              <Animated.View style={{ transform: [{ scale }] }}>
                <LumiFigure look={4} feel="calm" size={120} />
              </Animated.View>
            </View>
            <Text numberOfLines={2} style={styles.phaseText}>
              {BREATH_SCRIPT[scriptStep % BREATH_SCRIPT.length]}
            </Text>
            <Text style={styles.breathHint}>
              Follow Lumi — breathe in as it grows, out as it shrinks.
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct}%` as `${number}%` },
                ]}
              />
            </View>
            <Text style={styles.breathCount}>{seconds}s left</Text>

            <Button label="Stop" variant="dark" onPress={stopBreath} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, overflow: 'hidden' },
  safe: { flex: 1 },
  blobSun: {
    position: 'absolute',
    top: -110,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.sunSoft,
    opacity: 0.7,
  },
  blobSky: {
    position: 'absolute',
    top: 150,
    left: -120,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.sky,
    opacity: 0.55,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: TAB_BAR_BASE + spacing.xl,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  hello: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  good: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.muted },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: glass.fillStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: colors.white, fontSize: fontSize.xxs, fontWeight: '700' },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  cardSub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  sectionHead: { gap: 2, marginTop: spacing.xs },
  sectionEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  next: {
    backgroundColor: colors.blue,
    borderRadius: cardRadius + 6,
    padding: spacing.lg,
    gap: spacing.xs,
    ...floatingShadow,
    shadowOpacity: 0.2,
  },
  nextClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: cardRadius + 6,
    overflow: 'hidden',
  },
  nextGlow: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.sun,
    opacity: 0.22,
  },
  nextGlowSmall: {
    position: 'absolute',
    bottom: -44,
    left: -20,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 18,
    borderColor: colors.blueDark,
    opacity: 0.55,
  },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextEyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.blueDark,
    borderRadius: radius + 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  nextDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun },
  nextEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.white,
  },
  nextArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextWhen: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.white,
    marginTop: spacing.xs,
  },
  nextMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.white },
  nextPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  nextNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.white,
    opacity: 0.9,
  },
  nextBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  emptyCard: { gap: spacing.xs },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyMascot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...cardShadow,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: radius + 6,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  tileSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  moodCard: { gap: 2, padding: spacing.lg },
  moodWrap: { marginTop: spacing.sm },
  breath: {
    backgroundColor: colors.ink,
    borderRadius: cardRadius + 6,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...floatingShadow,
    shadowOpacity: 0.18,
  },
  breathClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: cardRadius + 6,
    overflow: 'hidden',
  },
  breathRing: {
    position: 'absolute',
    right: -40,
    top: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 22,
    borderColor: colors.blue,
    opacity: 0.35,
  },
  breathOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  breathEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.sun,
  },
  breathTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.white },
  breathSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.sky },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathModalBg: {
    flex: 1,
    backgroundColor: glass.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  breathModal: {
    backgroundColor: colors.white,
    borderRadius: cardRadius + 12,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
    ...floatingShadow,
    shadowOpacity: 0.25,
  },
  breathClose: {
    alignSelf: 'flex-end',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathModalEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
    marginTop: -spacing.lg,
  },
  breathStage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathStageRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: colors.white,
    opacity: 0.8,
  },
  phaseText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 22,
    minHeight: 44,
  },
  breathHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.chip,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.sun },
  breathCount: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.muted },
});
