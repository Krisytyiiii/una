import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import { colors, fontFamily, fontSize, buttonRadius, spacing, sizes } from '@/theme';

type Props = {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

/**
 * Auth-screen primary action: ink pill, sun arrow chip, press-in scale.
 * Shared by login and signup so the two screens feel like one product.
 */
export function PrimaryCta({
  label,
  busyLabel = 'Please wait…',
  busy = false,
  disabled = false,
  onPress,
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const off = busy || disabled;

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(0.975)}
        onPressOut={() => spring(1)}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off, busy }}
        style={[styles.cta, off && styles.ctaOff]}
      >
        <Text style={styles.ctaText}>{busy ? busyLabel : label}</Text>
        <View style={styles.ctaIcon}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <ArrowRight size={sizes.tabIcon} color={colors.ink} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cta: {
    height: 52,
    borderRadius: buttonRadius,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl - 4,
    paddingRight: spacing.sm - 2,
  },
  ctaOff: { opacity: 0.65 },
  ctaText: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.white, letterSpacing: 0.2 },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
