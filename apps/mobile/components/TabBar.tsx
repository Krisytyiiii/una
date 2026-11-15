import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments, type Href } from 'expo-router';
import House from 'lucide-react-native/icons/house';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Clock from 'lucide-react-native/icons/clock';
import User from 'lucide-react-native/icons/user';
import type { LucideIcon } from 'lucide-react-native';
import {
  colors,
  fontFamily,
  fontSize,
  glass,
  floatingShadow,
  hitSlop,
  navHeight,
  navRadius,
  spacing,
} from '@/theme';
import { useNotificationCount } from '@/lib/notifications-context';

// Only home, sessions and profile are real tabs.
// Book and Chat are root stack screens (app/book.tsx, app/chat.tsx), so they push.
const tabs: { key: string; label: string; Icon: LucideIcon; href: Href }[] = [
  { key: 'home', label: 'Home', Icon: House, href: '/(tabs)/home' },
  { key: 'book', label: 'Book', Icon: CalendarDays, href: '/book' },
  { key: 'chat', label: 'Chat', Icon: MessageCircle, href: '/chat' },
  { key: 'sessions', label: 'Sessions', Icon: Clock, href: '/(tabs)/sessions' },
  { key: 'profile', label: 'Profile', Icon: User, href: '/(tabs)/profile' },
];

/**
 * Vertical space the floating bar occupies above the bottom safe-area inset:
 * the bar itself plus the gap between it and the screen edge. Screens with
 * content/actions under the bar add this as bottom padding/margin.
 */
export const TAB_BAR_BASE = navHeight + 12;

const BAR_EDGE = spacing.lg - 2; // gap between the capsule and the screen edge
const PILL_INSET = 4; // gap between the sun pill and its slot

/**
 * Floating glass dock. Five equal slots in one frosted capsule, with a sun pill
 * sliding between them.
 *
 * The bar itself is the row (`flexDirection: 'row'` + `flex: 1` items) — there
 * is no nested wrapper and no explicit item widths, so the five slots always
 * divide the capsule exactly. The measured width is used *only* to place the
 * pill, so a bad measurement can never move the icons or labels.
 */
export function TabBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { unread } = useNotificationCount();
  const current = segments[segments.length - 1] ?? 'home';

  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorPlaced = useRef(false);

  const activeIndex = tabs.findIndex((tab) => tab.key === current);
  const safeIndex = activeIndex < 0 ? 0 : activeIndex;
  const slotWidth = barWidth > 0 ? barWidth / tabs.length : 0;

  useEffect(() => {
    if (slotWidth <= 0) return;
    const target = slotWidth * safeIndex;

    // The dock also mounts fresh on Chat/Book (they render it themselves), so
    // the first placement must be instant — otherwise the pill visibly flies
    // in from Home whenever you land on a non-tab screen.
    if (!indicatorPlaced.current) {
      indicatorX.setValue(target);
      indicatorPlaced.current = true;
      return;
    }

    Animated.spring(indicatorX, {
      toValue: target,
      damping: 18,
      stiffness: 210,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [indicatorX, slotWidth, safeIndex]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm + 2 }]}
    >
      <View
        style={styles.bar}
        onLayout={(event) => {
          const width = Math.max(0, event.nativeEvent.layout.width);
          // TEMPORARY diagnostic: remove once the bar renders correctly.
          console.log('[TabBar] bar width', width, 'slot', width / tabs.length);
          setBarWidth(width);
        }}
      >
        {/* Blur is a background layer, not a layout parent: the items live in a
            plain View so no platform's blur wrapper can squeeze them. */}
        <Glass />

        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: Math.max(0, slotWidth - PILL_INSET * 2),
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        ) : null}

        {tabs.map(({ key, label, Icon, href }) => {
          const active = current === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                key === 'home' && unread > 0 ? `Home, ${unread} unread notifications` : label
              }
              hitSlop={hitSlop}
              // `navigate` reuses an existing route instead of stacking a new
              // copy, so tab switches stay instant and back behaves.
              onPress={() => {
                if (active) return;
                router.navigate(href);
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={styles.iconWrap}>
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 1.8}
                  color={active ? colors.ink : colors.muted}
                />
                {key === 'home' && unread > 0 ? (
                  <View style={styles.badge} pointerEvents="none">
                    <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Frosted surface drawn *behind* the dock content. iOS gets a real blur;
 * Android falls back to the translucent `glass.fill` layer (native blur needs
 * a BlurTargetView, which would require wrapping every screen). The sheen +
 * hairline border keep both platforms reading as the same material.
 */
function Glass() {
  return (
    <>
      <BlurView
        pointerEvents="none"
        intensity={Platform.OS === 'ios' ? 55 : 0}
        tint="light"
        style={styles.glass}
      />
      <View pointerEvents="none" style={styles.sheen} />
    </>
  );
}

const styles = StyleSheet.create({
  // Anchored to the bottom edge, sized by its content: full width, safe-area
  // gap as padding.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: navHeight,
    marginHorizontal: BAR_EDGE,
    borderRadius: navRadius,
    // The bar is the row. Five `flex: 1` items divide it evenly.
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  indicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: PILL_INSET,
    borderRadius: navRadius - 10,
    backgroundColor: colors.sun,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    // Warm glow instead of a flat yellow block.
    shadowColor: '#C98A05',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    // Fixed line box + no Android font padding keeps icon+label optically
    // centred inside the sun pill instead of sitting a hair high.
    lineHeight: fontSize.xxs + 4,
    includeFontPadding: false,
    textAlign: 'center',
    color: colors.muted,
    letterSpacing: 0.1,
    alignSelf: 'stretch',
  },
  labelActive: {
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: fontSize.xxs,
    fontWeight: '700',
  },
  /** Immediate touch feedback so the dock never feels unresponsive. */
  pressed: { opacity: 0.55 },
  glass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: navRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : glass.fill,
    ...floatingShadow,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: navRadius,
    backgroundColor: glass.sheen,
    opacity: 0.45,
  },
});
