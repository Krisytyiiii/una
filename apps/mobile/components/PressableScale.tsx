import { useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Resting scale while pressed. Big surfaces should use a subtler value. */
  scaleTo?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable with a short spring dip. Gives cards and tiles a native-feeling
 * response without changing their layout (the animated style is applied to the
 * Pressable itself, so flex/padding stay exactly where the caller put them).
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const settle = (toValue: number, bounciness: number) => {
    Animated.spring(scale, {
      toValue,
      speed: 40,
      bounciness,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityState={{ disabled: disabled ?? false, ...rest.accessibilityState }}
      onPressIn={(event) => {
        settle(scaleTo, 0);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        settle(1, 7);
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}
