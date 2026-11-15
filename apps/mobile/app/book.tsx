import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Video from 'lucide-react-native/icons/video';
import Building2 from 'lucide-react-native/icons/building-complex';
import Check from 'lucide-react-native/icons/check';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import CalendarCheck from 'lucide-react-native/icons/calendar-check';
import { bookableDays, bookableSlots, type AvailabilityWindow, type BookableSlot } from '@dorsu/shared-services';
import { getSupabase } from '@/lib/supabase/client';
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
} from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { PressableScale } from '@/components/PressableScale';
import { PrimaryCta } from '@/components/PrimaryCta';
import { TabBar, TAB_BAR_BASE } from '@/components/TabBar';

const concerns = ['Academic', 'Personal', 'Financial', 'Social', 'Family', 'Other'] as const;
type Concern = (typeof concerns)[number];

const meetModes = [
  { id: 'inperson', title: 'In person', helper: 'Guidance Office, Main Campus.' },
  { id: 'online', title: 'Online', helper: 'A video link is sent before.' },
] as const;
type MeetModeId = (typeof meetModes)[number]['id'];

const modeIcons = { inperson: Building2, online: Video } as const;

const PERIODS = ['Morning', 'Afternoon', 'Evening'] as const;
type Period = (typeof PERIODS)[number];

function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

function monthShort(ymd: string): string {
  return dateFromYmd(ymd).toLocaleDateString('en-US', { month: 'short' });
}

function longDate(ymd: string): string {
  return dateFromYmd(ymd).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Bucket a "9:00 AM" label into a time-of-day group for the slot list. */
function periodOf(label: string): Period {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(label.trim());
  if (!match) return 'Morning';
  let hour = parseInt(match[1] ?? '0', 10);
  const isPm = (match[3] ?? '').toUpperCase() === 'PM';
  if (isPm && hour < 12) hour += 12;
  if (!isPm && hour === 12) hour = 0;
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

type SectionProps = {
  step: string;
  title: string;
  caption?: string;
  children: ReactNode;
};

/** Numbered card that gives the flow a single, scannable rhythm. */
function Section({ step, title, caption, children }: SectionProps) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionNum}>
          <Text style={styles.sectionNumText}>{step}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

export default function Book() {
  const [concern, setConcern] = useState<Concern | null>(null);
  const [mode, setMode] = useState<MeetModeId>('inperson');
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<BookableSlot | null>(null);
  const [alias, setAlias] = useState(true);
  const [windows, setWindows] = useState<AvailabilityWindow[] | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const insets = useSafeAreaInsets();

  // Real counselor availability (RLS lets any signed-in user read it). The
  // resulting slots are booking *requests* — the head still assigns/confirms.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const supabase = getSupabase();
        // Paused counselors keep their windows but must not surface new
        // bookable times — filter to counselors who are accepting bookings.
        const { data: availableCounselors, error: counselorError } = await supabase
          .from('counselors')
          .select('id')
          .eq('is_available', true)
          .limit(200);
        if (!alive) return;
        if (counselorError) throw counselorError;
        const counselorIds = (availableCounselors ?? []).map((c) => c.id as string);
        if (!counselorIds.length) {
          setWindows([]);
          return;
        }
        const { data, error } = await supabase
          .from('counselor_availability')
          .select('weekday, start_time, end_time, is_recurring, valid_from, valid_to')
          .in('counselor_id', counselorIds)
          .limit(500);
        if (!alive) return;
        if (error) throw error;
        setWindows((data ?? []) as AvailabilityWindow[]);
      } catch (e) {
        if (!alive) return;
        setAvailabilityError(
          e instanceof Error ? e.message : 'Could not load availability. Please try again.',
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const days = useMemo(() => (windows ? bookableDays(windows, new Date(), 7) : []), [windows]);
  const times = useMemo(
    () => (windows && day ? bookableSlots(windows, day, new Date()) : []),
    [windows, day],
  );

  // Open-time count per day, so a day tile can advertise what it actually holds
  // before the student taps it.
  const dayCounts = useMemo(() => {
    if (!windows) return {} as Record<string, number>;
    const now = new Date();
    const out: Record<string, number> = {};
    for (const d of days) out[d.date] = bookableSlots(windows, d.date, now).length;
    return out;
  }, [windows, days]);

  const timeGroups = useMemo(() => {
    const buckets: Record<Period, BookableSlot[]> = { Morning: [], Afternoon: [], Evening: [] };
    for (const t of times) buckets[periodOf(t.label)].push(t);
    return PERIODS.filter((p) => buckets[p].length > 0).map((p) => ({
      period: p,
      slots: buckets[p],
    }));
  }, [times]);

  const ready = concern !== null && day !== null && slot !== null;
  const dayLabel = day ? days.find((d) => d.date === day) : undefined;
  const dayMonth = day ? monthShort(day) : '';

  const pickDay = (date: string) => {
    setDay(date);
    // A time is only valid for the day it was generated from.
    setSlot(null);
  };

  const goCheckIn = () => {
    if (!ready || !concern || !day || !slot) return;
    router.push({
      pathname: '/check-in',
      params: {
        concern,
        mode,
        date: day,
        time: slot.label,
        start: slot.startIso,
        alias: alias ? '1' : '0',
      },
    });
  };

  const footerValue = ready && slot
    ? `${slot.label} · ${dayLabel?.weekdayShort ?? ''} ${dayLabel?.dayOfMonth ?? ''}`
    : 'Pick a concern, day and time';
  const footerMeta = ready && concern
    ? `${concern} · ${mode === 'online' ? 'Online' : 'In person'}${alias ? ' · Alias on' : ''}`
    : 'Sessions last about 60 minutes.';

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.blobSun} />
      <View pointerEvents="none" style={styles.blobSky} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>GUIDANCE OFFICE</Text>
            <Text style={styles.title}>Book a session</Text>
            <Text style={styles.subtitle}>Private, judgment-free support.</Text>
          </View>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>1 / 2</Text>
          </View>
        </View>

        <View style={styles.stepper}>
          <View style={[styles.stepSeg, styles.stepSegOn]} />
          <View style={styles.stepSeg} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Section step="01" title="What's on your mind?" caption="Pick what fits best. You can share more later.">
            <View style={styles.chips}>
              {concerns.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={concern === c}
                  selectedTone="blue"
                  onPress={() => setConcern(c)}
                  style={styles.concernChip}
                />
              ))}
            </View>
          </Section>

          <Section step="02" title="How would you like to meet?" caption="Both are private and confidential.">
            <View style={styles.modes}>
              {meetModes.map((m) => {
                const Icon = modeIcons[m.id];
                const selected = mode === m.id;
                return (
                  <PressableScale
                    key={m.id}
                    onPress={() => setMode(m.id)}
                    scaleTo={0.96}
                    hitSlop={hitSlop}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${m.title}. ${m.helper}`}
                    style={[styles.mode, selected && styles.modeOn]}
                  >
                    <View style={styles.modeTop}>
                      <View style={[styles.modeIcon, selected && styles.modeIconOn]}>
                        <Icon size={18} color={selected ? colors.ink : colors.blue} />
                      </View>
                      {selected ? (
                        <View style={styles.modeCheck}>
                          <Check size={11} color={colors.ink} strokeWidth={3} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.modeTitle}>{m.title}</Text>
                    <Text style={styles.modeHelper}>{m.helper}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </Section>

          <Section
            step="03"
            title="Choose a day"
            caption={days.length > 0 ? 'Next 7 available days' : undefined}
          >
            {availabilityError !== '' ? (
              <View style={styles.stateCol}>
                <Text style={styles.stateError}>{availabilityError}</Text>
                <Button
                  label="Try again"
                  variant="outline"
                  onPress={() => {
                    setWindows(null);
                    setAvailabilityError('');
                    setReloadKey((k) => k + 1);
                  }}
                />
              </View>
            ) : windows === null ? (
              <View style={styles.stateRow}>
                <ActivityIndicator size="small" color={colors.blue} />
                <Text style={styles.stateText}>Loading counselor availability…</Text>
              </View>
            ) : days.length === 0 ? (
              <View style={styles.stateRow}>
                <Text style={styles.stateText}>
                  No availability posted yet. Check back later or contact the Guidance Office.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.days}
              >
                {days.map((d) => {
                  const selected = day === d.date;
                  const count = dayCounts[d.date] ?? 0;
                  return (
                    <PressableScale
                      key={d.date}
                      onPress={() => pickDay(d.date)}
                      scaleTo={0.94}
                      hitSlop={hitSlop}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${d.weekdayShort} ${d.dayOfMonth}, ${count} open times`}
                      style={[styles.day, selected && styles.dayOn]}
                    >
                      <Text style={[styles.dayW, selected && styles.dayTextOn]}>
                        {d.weekdayShort}
                      </Text>
                      <Text style={[styles.dayN, selected && styles.dayTextOn]}>{d.dayOfMonth}</Text>
                      <Text style={[styles.dayM, selected && styles.dayTextOn]}>
                        {monthShort(d.date)}
                      </Text>
                      <View style={[styles.dayCount, selected && styles.dayCountOn]}>
                        <Text style={[styles.dayCountText, selected && styles.dayCountTextOn]}>
                          {count} open
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            )}
          </Section>

          <Section
            step="04"
            title="Available times"
            caption={
              day
                ? `${longDate(day)} · 60 min sessions`
                : 'Pick a day to see open times.'
            }
          >
            {day === null ? (
              <View style={styles.stateRow}>
                <Text style={styles.stateText}>Choose a day above to see open times.</Text>
              </View>
            ) : times.length === 0 ? (
              <View style={styles.stateRow}>
                <Text style={styles.stateText}>No open times on this day. Try another day.</Text>
              </View>
            ) : (
              <View style={styles.groups}>
                {timeGroups.map((group) => (
                  <View key={group.period} style={styles.group}>
                    <View style={styles.groupHead}>
                      <Text style={styles.groupLabel}>{group.period.toUpperCase()}</Text>
                      <View style={styles.groupLine} />
                      <Text style={styles.groupCount}>{group.slots.length}</Text>
                    </View>
                    <View style={styles.times}>
                      {group.slots.map((t) => (
                        <Chip
                          key={t.startIso}
                          label={t.label}
                          selected={slot?.startIso === t.startIso}
                          selectedTone="yellow"
                          onPress={() => setSlot(t)}
                          style={styles.timeChip}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Section>

          <View style={styles.alias}>
            <View style={styles.aliasIcon}>
              <ShieldCheck size={18} color={colors.ink} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.aliasTitle}>Book under my alias</Text>
              <Text style={styles.aliasSub}>Your name stays hidden until you choose to share it.</Text>
            </View>
            <Switch
              value={alias}
              onValueChange={setAlias}
              accessibilityRole="switch"
              accessibilityState={{ checked: alias }}
              trackColor={{ true: colors.sun, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { marginBottom: insets.bottom + TAB_BAR_BASE + spacing.sm }]}>
          <View style={styles.footerCard}>
            <View style={styles.footerTop}>
              <View style={[styles.footerIcon, ready && styles.footerIconReady]}>
                <CalendarCheck size={18} color={ready ? colors.ink : colors.muted} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.footerEyebrow}>
                  {ready ? 'READY TO CONTINUE' : 'YOUR SELECTION'}
                </Text>
                <Text style={styles.footerValue} numberOfLines={1}>
                  {footerValue}
                </Text>
                <Text style={styles.footerMeta} numberOfLines={1}>
                  {footerMeta}
                </Text>
              </View>
              {ready && dayMonth !== '' ? (
                <View style={styles.footerMonth}>
                  <Text style={styles.footerMonthText}>{dayMonth}</Text>
                </View>
              ) : null}
            </View>
            <PrimaryCta
              label="Continue to check-in"
              disabled={!ready}
              onPress={goCheckIn}
            />
          </View>
        </View>
      </SafeAreaView>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, overflow: 'hidden' },
  safe: { flex: 1 },
  blobSun: {
    position: 'absolute',
    top: -130,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.sunSoft,
    opacity: 0.65,
  },
  blobSky: {
    position: 'absolute',
    top: 210,
    left: -140,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.sky,
    opacity: 0.5,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 1.1,
    color: colors.muted,
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 1,
  },
  stepPill: {
    backgroundColor: colors.ink,
    borderRadius: radius + 8,
    paddingHorizontal: spacing.sm,
    height: 24,
    justifyContent: 'center',
  },
  stepPillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.4,
    color: colors.white,
  },
  stepper: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stepSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E7DDB6' },
  stepSegOn: { backgroundColor: colors.sun },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.4,
    color: colors.blue,
  },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  sectionCaption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 1,
    lineHeight: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  concernChip: { flexGrow: 1, minWidth: '30%' },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    borderRadius: radius + 8,
    backgroundColor: colors.chip,
    padding: spacing.md,
    gap: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeOn: { backgroundColor: colors.white, borderColor: colors.sun, ...cardShadow },
  modeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius + 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconOn: { backgroundColor: colors.sunSoft },
  modeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  modeHelper: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 15,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius + 4,
    padding: spacing.sm,
  },
  stateCol: { gap: spacing.sm },
  stateText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 17,
  },
  stateError: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.danger,
    lineHeight: 17,
  },
  days: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.xs },
  day: {
    width: 66,
    borderRadius: radius + 8,
    backgroundColor: colors.chip,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: 1,
  },
  dayOn: { backgroundColor: colors.blue, borderColor: colors.blueDark },
  dayW: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    letterSpacing: 0.5,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  dayN: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  dayM: { fontFamily: fontFamily.regular, fontSize: fontSize.xxs, color: colors.muted },
  dayTextOn: { color: colors.white },
  dayCount: {
    marginTop: spacing.xs,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: colors.white,
  },
  dayCountOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  dayCountText: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.blue },
  dayCountTextOn: { color: colors.white },
  groups: { gap: spacing.md },
  group: { gap: spacing.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.border },
  groupCount: { fontFamily: fontFamily.medium, fontSize: fontSize.xxs, color: colors.muted },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: { flexGrow: 1, minWidth: '30%' },
  alias: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...cardShadow,
  },
  aliasIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sunSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aliasTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  aliasSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 15,
    marginTop: 1,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  footerCard: {
    backgroundColor: colors.white,
    borderRadius: cardRadius + 6,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...floatingShadow,
    shadowOpacity: 0.14,
  },
  footerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius + 8,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerIconReady: { backgroundColor: colors.sunSoft },
  footerEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  footerValue: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  footerMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  footerMonth: {
    minWidth: 34,
    height: 22,
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerMonthText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.6,
    color: colors.blue,
    textTransform: 'uppercase',
  },
});
