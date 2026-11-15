import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import { colors, fontFamily, fontSize, spacing, sizes, hitSlop } from '@/theme';
import { Mascot } from '@/components/mascot/Lumi';
import { useMascot } from '@/components/mascot/useMascot';
import { Sunrise } from '@/components/illustrations/Sunrise';
import type { Feel } from '@/components/mascot/poses';
import { getSupabase } from '@/lib/supabase/client';
import { blockedParams, resolveAccountAccess } from '@/lib/supabase/accountAccess';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding';

interface Page {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
  /** Sun height as a fraction of the scene. The sun climbs with each page. */
  sunY: number;
  /** Lumi's resting mood for this step. */
  feel: Feel;
}

const pages: Page[] = [
  {
    key: 'chat',
    eyebrow: 'ANONYMOUS CHAT',
    title: "You don't have to carry it alone.",
    body: 'Talk to the Guidance Office in a safe, private space made for DOrSU students.',
    points: ['Chat under an alias, never your real name', 'A counselor replies within the day', 'Free for every DOrSU student'],
    sunY: 0.52,
    feel: 'happy',
  },
  {
    key: 'book',
    eyebrow: 'BOOK A SESSION',
    title: 'Time that fits your school day.',
    body: 'Pick a day and a way to meet that works around your classes.',
    points: ['Face-to-face, phone call or online', 'Same-week slots, Mon to Fri', 'Reschedule or cancel anytime'],
    sunY: 0.4,
    feel: 'calm',
  },
  {
    key: 'checkin',
    eyebrow: 'STRESS CHECK-INS',
    title: 'Notice how you are doing.',
    body: 'A private 2-minute check-in helps your counselor prepare for you.',
    points: ['10 short questions, about 2 minutes', 'Only your counselor sees answers', 'No scores or labels shown to you'],
    sunY: 0.28,
    feel: 'cheer',
  },
];

const HERO_RADIUS = 24;
const CTA_HEIGHT = 52;
const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export default function Onboarding() {
  const params = useLocalSearchParams<{ replay?: string }>();
  const replay = params.replay === '1';

  // `app/index` is the start route, so it doubles as the launch gate: an
  // existing session goes to Home, a returning visitor goes to Login, and
  // only a genuinely new student sees the welcome carousel. Profile can
  // still force it open with `?replay=1`.
  const [showOnboarding, setShowOnboarding] = useState(replay);

  useEffect(() => {
    // Replay is only reachable from Profile, which pushes a fresh screen, so
    // the initial state already shows the carousel — no gate check needed.
    if (replay) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      if (cancelled) return;
      if (session) {
        await markOnboardingSeen();
        if (cancelled) return;
        // The student app refuses staff accounts even when the session was
        // restored from storage, and sends a student without school details
        // through the one-time setup before Home.
        const access = await resolveAccountAccess(getSupabase(), session.user.id);
        if (cancelled) return;
        if (access.status === 'staff') {
          await getSupabase().auth.signOut().catch(() => undefined);
          router.replace({ pathname: '/blocked', params: blockedParams(access.role) });
          return;
        }
        if (access.status === 'incomplete') {
          router.replace({ pathname: '/register', params: { complete: '1' } });
          return;
        }
        router.replace('/(tabs)/home');
        return;
      }
      if (await hasSeenOnboarding()) {
        if (!cancelled) router.replace('/login');
        return;
      }
      if (!cancelled) setShowOnboarding(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [replay]);

  const [index, setIndex] = useState(0);
  const [pagerH, setPagerH] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const heroIn = useRef(new Animated.Value(0)).current;
  const lumi = useMascot('happy');
  const { setBase, react, reducedMotion } = lumi;
  const { width, height } = useWindowDimensions();

  const page = pages[index] ?? pages[0]!;
  const last = index === pages.length - 1;

  const heroH = clamp(168, height * 0.28, 264);
  const heroW = width - spacing.lg * 2;
  const maxScroll = Math.max(1, (pages.length - 1) * width);

  // The bar is painted by the scroll offset itself, so drag and tap both feel
  // like one control instead of a separate page indicator.
  const progress = scrollX.interpolate({
    inputRange: [0, maxScroll],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Scene swap: the sunrise/label/Lumi fade and lift when the step changes,
  // matching the copy that slides underneath.
  useEffect(() => {
    if (reducedMotion) {
      heroIn.setValue(1);
      return;
    }
    heroIn.setValue(0);
    Animated.timing(heroIn, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [index, reducedMotion, heroIn]);

  // Lumi rests in this step's mood and gives a short reaction on arrival.
  useEffect(() => {
    const feel = pages[index]?.feel ?? 'happy';
    setBase(feel);
    if (!reducedMotion) react(feel, 800);
  }, [index, reducedMotion, setBase, react]);

  const goTo = useCallback(
    (target: number) => {
      const clamped = clamp(0, target, pages.length - 1);
      setIndex(clamped);
      scroller.current?.scrollTo({ x: clamped * width, animated: true });
    },
    [width]
  );

  // The scene sits above the pager, so let a horizontal swipe on it advance
  // too — tapping the hero's CTA is not the only way forward. Only steals
  // gestures that are clearly horizontal, so taps on Lumi still land.
  const heroPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -40) goTo(index + 1);
          else if (g.dx >= 40) goTo(index - 1);
        },
      }),
    [goTo, index]
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
      setIndex(clamp(0, raw, pages.length - 1));
    },
    [width]
  );

  // Replaying from Profile means the student is already signed in; finishing
  // there returns to the profile instead of bouncing through Login.
  const finish = async () => {
    await markOnboardingSeen();
    if (replay) {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      router.replace(session ? '/(tabs)/home' : '/login');
      return;
    }
    router.replace('/login');
  };

  if (!showOnboarding) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  const heroSlide = heroIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} {...lumi.gaze}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>DOrSU GUIDANCE</Text>
        </View>
        <Pressable
          onPress={() => void finish()}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={replay ? 'Close the walkthrough' : 'Skip the walkthrough'}
        >
          <Text style={styles.skip}>{replay ? 'Close' : 'Skip'}</Text>
        </Pressable>
      </View>

      <View style={styles.trackWrap}>
        <View style={styles.trackRow}>
          <View style={styles.track}>
            <Animated.View
              style={[styles.trackFill, { transform: [{ scaleX: progress }] }]}
            />
          </View>
          <View style={styles.trackHits}>
            {pages.map((p, i) => (
              <Pressable
                key={p.key}
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityLabel={`Go to step ${i + 1} of ${pages.length}`}
                style={styles.trackHit}
              />
            ))}
          </View>
        </View>
      </View>

      <Animated.View
        {...heroPan.panHandlers}
        style={[
          styles.heroWrap,
          {
            height: heroH + 12,
            opacity: heroIn,
            transform: [{ translateY: heroSlide }],
          },
        ]}
      >
        <View style={[styles.heroCard, { height: heroH, width: heroW }]}>
          <Sunrise width={heroW} height={heroH} sunY={page.sunY} />
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>{page.eyebrow}</Text>
          </View>
          <Text style={styles.count}>
            {String(index + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}
          </Text>
        </View>
        <View style={styles.lumi} pointerEvents="box-none">
          <Mascot controller={lumi} size={104} />
        </View>
      </Animated.View>

      <View
        style={styles.pagerWrap}
        onLayout={(e) => setPagerH(Math.round(e.nativeEvent.layout.height))}
      >
        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.pager}
        >
          {pages.map((p) => (
            <View key={p.key} style={{ width, height: pagerH || undefined }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={styles.copy}
              >
                <View style={styles.copyInner}>
                  <Text style={styles.title}>{p.title}</Text>
                  <Text style={styles.body}>{p.body}</Text>
                  <View style={styles.ledger}>
                    {p.points.map((pt, i) => (
                      <View key={pt} style={[styles.ledgerRow, i > 0 && styles.ledgerDivider]}>
                        <Text style={styles.ledgerNum}>{String(i + 1).padStart(2, '0')}</Text>
                        <Text style={styles.ledgerText}>{pt}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      <View style={styles.footer}>
        {index > 0 ? (
          <Pressable
            onPress={() => goTo(index - 1)}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Go back a step"
            style={styles.back}
          >
            <ArrowLeft size={sizes.tabIcon} color={colors.ink} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => (last ? void finish() : goTo(index + 1))}
          accessibilityRole="button"
          accessibilityLabel={last ? (replay ? 'Done' : 'Log in') : 'Continue to the next step'}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{last ? (replay ? 'Done' : 'Log in') : 'Continue'}</Text>
          <View style={styles.ctaIcon}>
            <ArrowRight size={sizes.tabIcon} color={colors.ink} />
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sun },
  brandText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
    letterSpacing: 1.6,
  },
  skip: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },

  trackWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  trackRow: { height: 24, justifyContent: 'center' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.blue,
    transformOrigin: 'left',
  },
  trackHits: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  trackHit: { flex: 1 },

  heroWrap: {
    marginTop: spacing.md,
    alignSelf: 'center',
    justifyContent: 'flex-start',
  },
  heroCard: {
    borderRadius: HERO_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.sky,
  },
  pill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun },
  pillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
    letterSpacing: 1.2,
  },
  count: {
    position: 'absolute',
    left: spacing.md + 2,
    bottom: spacing.md,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.white,
    letterSpacing: 1.2,
    opacity: 0.9,
  },
  lumi: { position: 'absolute', right: spacing.md, bottom: 0 },

  pagerWrap: { flex: 1, marginTop: spacing.xs },
  pager: { flex: 1 },
  copy: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  copyInner: { gap: spacing.sm },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, lineHeight: 19, color: colors.muted },

  ledger: { marginTop: spacing.xs },
  ledgerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 9 },
  ledgerDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  ledgerNum: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
    letterSpacing: 0.5,
    paddingTop: 2,
    width: 18,
  },
  ledgerText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.ink },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  back: {
    width: CTA_HEIGHT,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cta: {
    minWidth: 176,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginLeft: 'auto',
    paddingLeft: spacing.xl - 4,
    paddingRight: spacing.sm - 2,
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.white,
    letterSpacing: 0.2,
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
