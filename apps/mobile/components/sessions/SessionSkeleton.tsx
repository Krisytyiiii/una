import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, cardRadius, spacing } from '@/theme';

/**
 * Loading placeholders for the sessions list. A soft opacity pulse keeps the
 * screen feeling alive without a spinner jumping the layout when data lands.
 */
export function SessionSkeleton() {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: pulse }}
    >
      {[0, 1, 2].map((index) => (
        <View key={`skeleton-${index}`} style={styles.card}>
          <View style={styles.top}>
            <View style={styles.date} />
            <View style={styles.head}>
              <View style={styles.lineWide} />
              <View style={styles.lineNarrow} />
            </View>
            <View style={styles.pill} />
          </View>
          <View style={styles.meta} />
          <View style={styles.footer} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  date: {
    width: 48,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.chip,
  },
  head: { flex: 1, gap: spacing.sm },
  lineWide: {
    height: 12,
    width: '72%',
    borderRadius: 6,
    backgroundColor: colors.chip,
  },
  lineNarrow: {
    height: 9,
    width: '45%',
    borderRadius: 5,
    backgroundColor: colors.disabledBg,
  },
  pill: {
    width: 62,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.disabledBg,
  },
  meta: {
    height: 9,
    width: '52%',
    borderRadius: 5,
    backgroundColor: colors.disabledBg,
  },
  footer: {
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chip,
  },
});
