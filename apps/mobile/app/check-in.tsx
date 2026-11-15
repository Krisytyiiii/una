import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Brain from 'lucide-react-native/icons/brain';
import Check from 'lucide-react-native/icons/check';
import CircleCheckBig from 'lucide-react-native/icons/circle-check-big';
import Clock from 'lucide-react-native/icons/clock';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Sparkles from 'lucide-react-native/icons/sparkles';
import X from 'lucide-react-native/icons/x';
import { getSupabase } from '@/lib/supabase/client';
import { ensureStudentRows, friendlyDbError } from '@/lib/supabase/ensureStudent';
import {
  colors,
  cardRadius,
  cardShadow,
  fontFamily,
  fontSize,
  radius,
  spacing,
  sizes,
} from '@/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AppDialog } from '@/components/AppDialog';
import { IconButton } from '@/components/IconButton';
import { LumiFigure } from '@/components/mascot/Lumi';
import { PressableScale } from '@/components/PressableScale';
import { SunCorner } from '@/components/illustrations/SunCorner';
import {
  submitPss10,
  bookAppointment,
  PSS10_ITEMS as pssQuestions,
  PSS10_LABELS as pssLabels,
  PSS10_INSTRUCTIONS,
} from '@dorsu/shared-services';

/** The instrument is fixed at 10 items; a module constant keeps the gesture
 * handlers (created once) from reading stale render state. */
const TOTAL = pssQuestions.length;
const CTA_HEIGHT = 52;
const CARD_SWIPE_LIMIT = 90;
const CARD_SWIPE_THRESHOLD = 56;

function combineDateTime(dateIso: string, timeLabel: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const t = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(timeLabel.trim());
  if (!d || !t) return null;
  let h = parseInt(t[1] ?? '0', 10);
  const mer = (t[3] ?? '').toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, Number(t[2]));
}

/** Rough remaining time — assumes about 12 seconds per item. */
function minutesLeft(index: number): number {
  return Math.max(1, Math.ceil(((TOTAL - index) * 12) / 60));
}

/** Clock reads live outside the component: the React Compiler purity rule
 * flags `Date.now()` inside components, even in event handlers. */
function nowMs(): number {
  return Date.now();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export default function CheckIn() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(TOTAL).fill(-1));
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Questions the student has actually reached; the progress bar only lets them
  // jump back into that range so a stray tap cannot skip the assessment.
  const [maxVisited, setMaxVisited] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirmExit, setConfirmExit] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const wipe = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollViewInstance>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number | null>(null);

  const params = useLocalSearchParams<{
    concern?: string;
    mode?: string;
    date?: string;
    time?: string;
    start?: string;
    alias?: string;
    appointmentId?: string;
  }>();
  // With booking params this screen books a session after the PSS-10. With an
  // appointmentId it records a pre-session check-in for that confirmed
  // session. Without either ("Stress check" on Home) it only records the
  // assessment.
  const bookingMode = Boolean(params.concern && params.mode && params.date && params.time);
  const preSessionMode = !bookingMode && Boolean(params.appointmentId);

  const current = answers[index] ?? -1;
  const last = index === TOTAL - 1;
  const answered = answers.filter((a) => a >= 0).length;
  const percent = Math.round((answered / TOTAL) * 100);

  // Latest values for callbacks (gesture handlers + auto-advance) that must not
  // capture a stale render.
  const stateRef = useRef({ index, answers, busy });
  stateRef.current = { index, answers, busy };
  const goToRef = useRef<(next: number) => void>(() => {});

  // Slide the next question in from the side the student is travelling toward.
  // No state is set here — only the animation values move.
  useEffect(() => {
    fade.setValue(0);
    slide.setValue(direction * 22);
    pop.setValue(0.96);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        speed: 22,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        speed: 24,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, [direction, fade, index, pop, slide]);

  // Keep the top progress line in sync with how many items are answered.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: answered / TOTAL,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [answered, progress]);

  // A long card can be scrolled; every new question starts at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Start the timer after mount so render stays pure (Date.now() in a hook
  // initializer trips the react-hooks/purity rule).
  useEffect(() => {
    if (startedAt.current === null) startedAt.current = nowMs();
  }, []);

  const goTo = (next: number) => {
    if (next === index || next < 0 || next >= TOTAL) return;
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setDirection(next > index ? 1 : -1);
    setIndex(next);
    setMaxVisited((m) => Math.max(m, next));
    // Snap the swipe offset so the incoming card does not enter off-centre.
    swipeX.setValue(0);
  };
  goToRef.current = goTo;

  const pick = (v: number) => {
    if (busy) return;
    const wasAnswered = answers[index] >= 0;
    setAnswers((a) => a.map((x, i) => (i === index ? v : x)));
    // A short spring on the radio ring so the tap feels acknowledged.
    wipe.setValue(0.6);
    Animated.spring(wipe, { toValue: 1, speed: 26, bounciness: 12, useNativeDriver: true }).start();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    // Auto-advance on a fresh answer only: when a student revisits a question
    // to change it, they stay put instead of being pushed along.
    if (!wasAnswered && index < TOTAL - 1) {
      const from = index;
      advanceTimer.current = setTimeout(() => {
        if (stateRef.current.index !== from) return;
        if (stateRef.current.answers[from] < 0) return;
        goToRef.current(from + 1);
      }, 460);
    }
  };

  // Horizontal swipes move between questions; vertical drags still scroll.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.35,
      onPanResponderMove: (_e, g) => {
        const clamped = Math.max(-CARD_SWIPE_LIMIT, Math.min(CARD_SWIPE_LIMIT, g.dx));
        swipeX.setValue(clamped);
      },
      onPanResponderRelease: (_e, g) => {
        const { index: i, answers: a } = stateRef.current;
        const canForward = a[i] >= 0 && i < TOTAL - 1;
        if (g.dx <= -CARD_SWIPE_THRESHOLD && canForward) goToRef.current(i + 1);
        else if (g.dx >= CARD_SWIPE_THRESHOLD && i > 0) goToRef.current(i - 1);
        Animated.spring(swipeX, {
          toValue: 0,
          speed: 24,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeX, {
          toValue: 0,
          speed: 24,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const screenTitle = bookingMode
    ? 'Book a session'
    : preSessionMode
      ? 'Pre-session check-in'
      : 'Stress check';
  const eyebrow = bookingMode
    ? 'STEP 2 OF 2 · CHECK-IN'
    : preSessionMode
      ? 'BEFORE YOUR SESSION'
      : 'A MOMENT FOR YOU';

  const finish = async () => {
    if (busy) return;
    setError('');
    const missing = answers.findIndex((a) => a < 0);
    if (missing >= 0) {
      setError(`Question ${missing + 1} still needs an answer.`);
      goTo(missing);
      return;
    }
    const { concern, mode, date, time, alias, start } = params;
    // `start` is the exact UTC instant picked from real availability; fall
    // back to parsing the label for older links/params.
    const scheduledAt =
      start !== undefined
        ? new Date(start)
        : date && time
          ? combineDateTime(date, time)
          : null;
    if (bookingMode) {
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= nowMs()) {
        setError('That time has passed. Go back and pick another.');
        return;
      }
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please log in again to finish booking.');
        return;
      }
      let student: { id: string } | null = null;
      const first = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (first.error) {
        setError(friendlyDbError(first.error.message));
        return;
      }
      student = (first.data as { id: string } | null) ?? null;

      if (!student) {
        // Legacy accounts (registered while email confirmation blocked the
        // signup insert) can have a profile but no students row. Repair it
        // from auth metadata before failing the flow.
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaString = (key: string) =>
          typeof meta[key] === 'string' ? (meta[key] as string) : undefined;
        const ensured = await ensureStudentRows(supabase, user.id, {
          email: user.email ?? '',
          fullName: metaString('full_name') ?? '',
          studentNo: metaString('student_no'),
          program: metaString('program'),
          yearLevel: metaString('year_level'),
        });
        if (!ensured.ok) {
          setError(friendlyDbError(ensured.error));
          return;
        }
        const retry = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (retry.error) {
          setError(friendlyDbError(retry.error.message));
          return;
        }
        student = (retry.data as { id: string } | null) ?? null;
      }

      if (!student) {
        setError('Account setup is incomplete. Please log in again.');
        return;
      }
      const pss = (await submitPss10(supabase, {
        studentId: student.id,
        answers,
        ...(preSessionMode && params.appointmentId
          ? { appointmentId: params.appointmentId }
          : {}),
      })) as {
        id: string;
      };
      if (bookingMode && scheduledAt) {
        await bookAppointment(supabase, {
          studentId: student.id,
          scheduledAt,
          mode: mode === 'online' ? 'online' : 'in_person',
          concern: `${concern} support session requested`,
          isAnonymous: alias === '1',
          pss10Id: pss.id,
        });
      }
      setDurationSec(
        Math.max(1, Math.round((nowMs() - (startedAt.current ?? nowMs())) / 1000)),
      );
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Leaving mid-assessment is confirmed so a stray tap cannot throw away
  // answers the student already gave.
  const requestClose = () => {
    if (answered > 0) setConfirmExit(true);
    else router.back();
  };

  // Celebratory entrance for the completion screen.
  useEffect(() => {
    if (!done) return;
    halo.setValue(0);
    Animated.spring(halo, { toValue: 1, speed: 12, bounciness: 9, useNativeDriver: true }).start();
  }, [done, halo]);

  if (done) {
    const doneTitle = bookingMode
      ? 'You’re booked and checked in'
      : preSessionMode
        ? 'Pre-session check-in saved'
        : 'Check-in saved';
    const doneBody = bookingMode
      ? 'Your counselor will see your answers before the session, so you can start faster.'
      : preSessionMode
        ? 'Your counselor can review this before your session. You can still update the check-in from your session card.'
        : 'Your answers are saved privately. Your counselor can see them when you meet.';
    const primaryLabel = bookingMode
      ? 'Open messages'
      : preSessionMode
        ? 'View my sessions'
        : 'Back to home';
    const primaryTo = bookingMode ? '/chat' : preSessionMode ? '/(tabs)/sessions' : '/(tabs)/home';
    const secondaryLabel = bookingMode
      ? 'View my sessions'
      : preSessionMode
        ? 'Back to home'
        : 'Book a session';
    const secondaryTo = bookingMode
      ? '/(tabs)/sessions'
      : preSessionMode
        ? '/(tabs)/home'
        : '/book';

    return (
      <View style={styles.root}>
        <View style={styles.sky} pointerEvents="none" />
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.doneWrap}
          >
            <Animated.View
              style={[
                styles.doneHalo,
                {
                  opacity: halo,
                  transform: [
                    { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                  ],
                },
              ]}
            >
              <View style={styles.doneRing} />
              <View style={styles.doneMascot}>
                <LumiFigure look={4} feel="happy" size={92} />
              </View>
              <View style={styles.doneCheck}>
                <CircleCheckBig size={22} color={colors.white} />
              </View>
            </Animated.View>

            <Text style={styles.doneEyebrow}>CHECK-IN COMPLETE</Text>
            <Text style={styles.doneTitle}>{doneTitle}</Text>
            <Text style={styles.doneBody}>{doneBody}</Text>

            <View style={styles.statRow}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{answered}</Text>
                <Text style={styles.statLabel}>answers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{percent}%</Text>
                <Text style={styles.statLabel}>complete</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{formatDuration(durationSec)}</Text>
                <Text style={styles.statLabel}>time taken</Text>
              </View>
            </View>

            <Card style={styles.doneCard}>
              <View style={styles.doneRow}>
                <View style={[styles.doneIcon, { backgroundColor: colors.successSoft }]}>
                  <Check size={14} color={colors.success} strokeWidth={3} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.doneRowTitle}>All {TOTAL} questions answered</Text>
                  <Text style={styles.doneRowSub}>Nothing was skipped</Text>
                </View>
              </View>
              <View style={styles.doneDivider} />
              <View style={styles.doneRow}>
                <View style={[styles.doneIcon, { backgroundColor: colors.sky }]}>
                  <ShieldCheck size={14} color={colors.blue} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.doneRowTitle}>Private to your counselor</Text>
                  <Text style={styles.doneRowSub}>
                    {bookingMode || preSessionMode
                      ? 'Linked to your session'
                      : 'Only visible in your care record'}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.doneActions}>
              <Button label={primaryLabel} onPress={() => router.replace(primaryTo)} />
              <Button
                label={secondaryLabel}
                variant="outline"
                onPress={() => router.replace(secondaryTo)}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.sun} pointerEvents="none">
        <SunCorner size={160} />
      </View>
      <View style={styles.sky} pointerEvents="none" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <IconButton label="Close check-in" onPress={requestClose}>
            <X size={sizes.tabIcon} color={colors.ink} />
          </IconButton>
          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>{eyebrow}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {screenTitle}
            </Text>
          </View>
          <View style={styles.timePill}>
            <Clock size={11} color={colors.blue} />
            <Text style={styles.timeText}>{minutesLeft(index)} min</Text>
          </View>
        </View>

        <View style={styles.topTrack}>
          <Animated.View
            style={[
              styles.topFill,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
        >
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaKicker}>QUESTION</Text>
              <Text style={styles.metaStrong}>
                {index + 1}
                <Text style={styles.metaTotal}> / {TOTAL}</Text>
              </Text>
            </View>
            <View style={styles.metaRight}>
              <Text style={styles.metaPercent}>{percent}%</Text>
              <Text style={styles.metaText}>
                {answered} of {TOTAL} answered
              </Text>
            </View>
          </View>

          <View style={styles.progress} accessibilityRole="tablist">
            {pssQuestions.map((_, i) => {
              const isAnswered = answers[i] >= 0;
              const isCurrent = i === index;
              const reachable = i <= maxVisited;
              return (
                <Pressable
                  key={`seg-${i}`}
                  onPress={() => {
                    if (reachable) goTo(i);
                  }}
                  disabled={!reachable}
                  hitSlop={{ top: 10, bottom: 10 }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isCurrent, disabled: !reachable }}
                  accessibilityLabel={`Question ${i + 1}, ${
                    isAnswered ? 'answered' : 'not answered'
                  }`}
                  style={styles.segmentHit}
                >
                  <View
                    style={[
                      styles.segment,
                      isAnswered && styles.segmentAnswered,
                      isCurrent && styles.segmentCurrent,
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          <Animated.View
            {...swipe.panHandlers}
            style={{
              opacity: fade,
              transform: [
                { translateX: swipeX },
                {
                  translateY: slide.interpolate({
                    inputRange: [-22, 0, 22],
                    outputRange: [-8, 0, 8],
                    extrapolate: 'clamp',
                  }),
                },
                { scale: pop },
              ],
            }}
          >
            <Card style={styles.qcard}>
              <View style={styles.qTop}>
                <View style={styles.qIcon}>
                  <Brain size={16} color={colors.blue} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.qKicker}>PSS-10 · SELF CHECK</Text>
                  <Text style={styles.qStem}>{PSS10_INSTRUCTIONS}</Text>
                </View>
                <View style={styles.qCounter}>
                  <Text style={styles.qCounterText}>Q{index + 1}</Text>
                </View>
              </View>

              <Text style={styles.q}>{pssQuestions[index]}</Text>

              <View style={styles.options} accessibilityRole="radiogroup">
                {pssLabels.map((label, v) => {
                  const on = current === v;
                  return (
                    <PressableScale
                      key={`a-${v}`}
                      onPress={() => pick(v)}
                      disabled={busy}
                      scaleTo={0.985}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on, disabled: busy }}
                      accessibilityLabel={label}
                      style={[styles.option, on && styles.optionOn]}
                    >
                      <View style={[styles.accentBar, on && styles.accentBarOn]} />
                      <View style={[styles.radio, on && styles.radioOn]}>
                        {on ? (
                          <Animated.View style={{ transform: [{ scale: wipe }] }}>
                            <Check size={12} color={colors.ink} strokeWidth={3.5} />
                          </Animated.View>
                        ) : null}
                      </View>
                      <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{label}</Text>
                      {on ? <Text style={styles.optionTag}>SELECTED</Text> : null}
                    </PressableScale>
                  );
                })}
              </View>

              {current >= 0 ? (
                <View style={styles.picked}>
                  <Check size={12} color={colors.success} strokeWidth={3} />
                  <Text style={styles.pickedText}>
                    Your answer · <Text style={styles.pickedValue}>{pssLabels[current]}</Text>
                  </Text>
                </View>
              ) : (
                <View style={styles.hintRow}>
                  <Sparkles size={12} color={colors.muted} />
                  <Text style={styles.unpicked}>
                    Tap an answer to continue — you can change it anytime.
                  </Text>
                </View>
              )}
            </Card>
          </Animated.View>

          <View style={styles.privacy}>
            <ShieldCheck size={14} color={colors.blue} />
            <Text style={styles.privacyText}>
              {bookingMode || preSessionMode
                ? 'Private — linked to your session and visible only to your counselor.'
                : 'Private — only your counselor can see your answers.'}
            </Text>
          </View>

          {error !== '' ? (
            <View style={styles.errWrap}>
              <Text style={styles.err}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.bar}>
          <Pressable
            onPress={() => goTo(index - 1)}
            disabled={index === 0 || busy}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Previous question"
            accessibilityState={{ disabled: index === 0 || busy }}
            style={({ pressed }) => [
              styles.backBtn,
              (index === 0 || busy) && styles.backBtnOff,
              pressed && styles.backBtnPressed,
            ]}
          >
            <ArrowLeft
              size={sizes.tabIcon}
              color={index === 0 || busy ? colors.disabledText : colors.ink}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              if (last) void finish();
              else goTo(index + 1);
            }}
            disabled={current < 0 || busy}
            accessibilityRole="button"
            accessibilityLabel={
              busy
                ? 'Saving your check-in'
                : last
                  ? 'Finish check-in'
                  : 'Next question'
            }
            accessibilityState={{ disabled: current < 0 || busy }}
            style={({ pressed }) => [
              styles.cta,
              (current < 0 || busy) && styles.ctaOff,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={[styles.ctaText, (current < 0 || busy) && styles.ctaTextOff]}>
              {busy
                ? bookingMode
                  ? 'Booking…'
                  : 'Saving…'
                : last
                  ? 'Finish check-in'
                  : 'Next question'}
            </Text>
            <View style={[styles.ctaIcon, (current < 0 || busy) && styles.ctaIconOff]}>
              {last ? (
                <CircleCheckBig
                  size={sizes.tabIcon}
                  color={current < 0 || busy ? colors.disabledText : colors.ink}
                />
              ) : (
                <ArrowRight
                  size={sizes.tabIcon}
                  color={current < 0 || busy ? colors.disabledText : colors.ink}
                />
              )}
            </View>
          </Pressable>
        </View>
      </SafeAreaView>

      <AppDialog
        dialog={
          confirmExit
            ? {
                title: 'Leave check-in?',
                message: `You’ve answered ${answered} of ${TOTAL} questions. Nothing is saved until you finish.`,
                icon: <Brain size={20} color={colors.blue} />,
                note: 'Your answers stay on this screen until you tap Finish.',
                actions: [
                  { label: 'Keep answering', onPress: () => setConfirmExit(false) },
                  {
                    label: 'Leave check-in',
                    variant: 'dangerOutline',
                    onPress: () => router.back(),
                  },
                ],
              }
            : null
        }
        onClose={() => setConfirmExit(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  sun: { position: 'absolute', top: -50, left: -50, opacity: 0.7 },
  sky: {
    position: 'absolute',
    bottom: -120,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.sky,
    opacity: 0.55,
  },

  /* ------------------------------- header -------------------------------- */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  headerText: { flex: 1, gap: 1 },
  headerEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.sky,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  timeText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
  },
  topTrack: {
    height: 4,
    marginTop: spacing.md,
    backgroundColor: colors.disabledBg,
    overflow: 'hidden',
  },
  topFill: {
    height: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.blue,
  },

  /* ------------------------------- progress ------------------------------ */

  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  metaKicker: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  metaStrong: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  metaTotal: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  metaRight: { alignItems: 'flex-end' },
  metaPercent: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.blue,
  },
  metaText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  progress: { flexDirection: 'row', gap: spacing.xs },
  segmentHit: { flex: 1, paddingVertical: 5 },
  segment: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.disabledBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segmentAnswered: { backgroundColor: colors.blue, borderColor: colors.blue },
  segmentCurrent: { backgroundColor: colors.sun, borderColor: colors.sun },

  /* ------------------------------ question ------------------------------- */

  qcard: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: cardRadius + 6,
    ...cardShadow,
  },
  qTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  qIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qKicker: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  qStem: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  qCounter: {
    backgroundColor: colors.chip,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  qCounterText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
  },
  q: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 7,
    color: colors.ink,
  },
  options: { gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius + 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    overflow: 'hidden',
  },
  optionOn: {
    borderColor: colors.sun,
    backgroundColor: colors.sunSoft,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: 'transparent',
  },
  accentBarOn: { backgroundColor: colors.sun },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  radioOn: { borderColor: colors.sun, backgroundColor: colors.sun },
  optionLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  optionLabelOn: { fontFamily: fontFamily.bold },
  optionTag: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.7,
    color: colors.warn,
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pickedText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.success,
  },
  pickedValue: { fontFamily: fontFamily.bold },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  unpicked: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },

  /* ------------------------------- privacy ------------------------------- */

  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.sky,
    borderRadius: cardRadius,
    padding: spacing.md,
  },
  privacyText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.blue,
  },

  /* -------------------------------- errors ------------------------------- */

  errWrap: {
    padding: spacing.sm,
    borderRadius: radius,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  err: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
  },

  /* -------------------------------- footer ------------------------------- */

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamLine,
  },
  backBtn: {
    width: CTA_HEIGHT,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnOff: { backgroundColor: colors.disabledBg, borderColor: colors.border },
  backBtnPressed: { opacity: 0.85 },
  cta: {
    flex: 1,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingLeft: spacing.xl - 4,
    paddingRight: spacing.sm - 2,
  },
  ctaOff: { backgroundColor: colors.disabledBg },
  ctaPressed: { opacity: 0.9 },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.white,
    letterSpacing: 0.2,
  },
  ctaTextOff: { color: colors.disabledText },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconOff: { backgroundColor: colors.white },

  /* --------------------------------- done -------------------------------- */

  doneWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  doneHalo: {
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneRing: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 1,
    borderColor: colors.white,
    opacity: 0.7,
  },
  doneMascot: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.sunSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doneCheck: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  doneEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 1,
    color: colors.muted,
  },
  doneTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 5,
    color: colors.ink,
    textAlign: 'center',
  },
  doneBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm + 5,
    color: colors.muted,
    textAlign: 'center',
  },
  statRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: cardRadius,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  statTile: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    letterSpacing: 0.4,
    color: colors.warn,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: colors.creamLine,
  },
  doneCard: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneRowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  doneRowSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  doneDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.creamLine,
  },
  doneActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
});
