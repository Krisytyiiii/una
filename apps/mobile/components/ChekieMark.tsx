import { Image, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

/**
 * Chekie's panda mark — the same asset the web portal uses
 * (`apps/web/public/images/favicon.png`). Kept as a round white tile with a
 * light-blue ring so it reads as a logo, not a decorative sun.
 */
export function ChekieMark({ size = 40 }: { size?: number }) {
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Image
        source={require('@/assets/favicon.png')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.sky,
    backgroundColor: colors.white,
  },
});
