import { View, StyleSheet } from 'react-native';
import Star from 'lucide-react-native/icons/star';
import { colors, hitSlop, spacing, sizes } from '@/theme';
import { PressableScale } from '@/components/PressableScale';

type Props = { value: number; onChange: (v: number) => void; size?: number };

export function StarRating({ value, onChange, size = sizes.tabIcon }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PressableScale
          key={`star-${n}`}
          onPress={() => onChange(n)}
          scaleTo={0.8}
          hitSlop={hitSlop}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          accessibilityLabel={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            strokeWidth={2}
            color={n <= value ? colors.sun : colors.muted}
            fill={n <= value ? colors.sun : 'transparent'}
          />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
