import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export type SessionTab = 'Upcoming' | 'Past' | 'Canceled';
export const SESSION_TABS: readonly SessionTab[] = ['Upcoming', 'Past', 'Canceled'];

type Props = {
  active: SessionTab;
  counts: Record<SessionTab, number>;
  loading: boolean;
  onChange: (tab: SessionTab) => void;
};

const INSET = 4;

/**
 * Segmented control for the session list. A white pill springs to the active
 * slot (instant on first paint, like the tab dock) so switching feels native
 * instead of a hard re-render.
 */
export function SessionTabs({ active, counts, loading, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const index = Math.max(0, SESSION_TABS.indexOf(active));
  const slot = width > 0 ? width / SESSION_TABS.length : 0;

  useEffect(() => {
    if (slot <= 0) return;
    const target = slot * index;
    if (!placed.current) {
      indicatorX.setValue(target);
      placed.current = true;
      return;
    }
    Animated.spring(indicatorX, {
      toValue: target,
      damping: 20,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [indicatorX, index, slot]);

  return (
    <View
      accessibilityRole="tablist"
      style={styles.bar}
      onLayout={(event) => setWidth(Math.max(0, event.nativeEvent.layout.width))}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: Math.max(0, slot - INSET * 2), transform: [{ translateX: indicatorX }] },
          ]}
        />
      ) : null}

      {SESSION_TABS.map((tab) => {
        const selected = tab === active;
        const count = counts[tab];
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tab}, ${count} sessions`}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
              {tab}
            </Text>
            <View style={[styles.count, selected && styles.countOn]}>
              <Text style={[styles.countText, selected && styles.countTextOn]}>
                {loading ? '—' : count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: INSET,
    borderRadius: 20,
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  indicator: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 1,
  },
  itemPressed: { opacity: 0.6 },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  labelOn: { fontFamily: fontFamily.bold, color: colors.ink },
  count: {
    minWidth: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.disabledBg,
  },
  countOn: { backgroundColor: colors.sunSoft },
  countText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  countTextOn: { color: colors.ink },
});
