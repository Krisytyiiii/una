import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, glass, sheetRadius, sheetShadow, spacing } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Blocks backdrop, Android-back and drag dismissal while a write is in flight. */
  dismissible?: boolean;
  /** Accessibility label for the backdrop tap target. */
  accessibilityLabel?: string;
};

/**
 * Floating bottom sheet shared by the session details, reschedule and cancel
 * surfaces. Slides up on a soft spring, fades a dim backdrop in, and can be
 * dismissed by tapping outside or dragging the grabber down. Kept free of any
 * data logic so screens own the content and the mutations.
 *
 * The sheet stays mounted until the exit animation finishes, which avoids the
 * "pop" you get from unmounting a native Modal mid-transition.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  dismissible = true,
  accessibilityLabel = 'Close',
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);

  const openY = useRef(new Animated.Value(height)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  // Latest values for the once-created PanResponder.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;
  const heightRef = useRef(height);
  heightRef.current = height;

  const closingRef = useRef(false);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const animateOut = useCallback(() => {
    // Called from the visibility effect even when nothing is mounted (first
    // render with visible=false), so bail before touching the animation.
    if (!mountedRef.current || closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(openY, {
        toValue: heightRef.current,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      closingRef.current = false;
      // A fast reopen cancels this timing; never unmount a visible sheet.
      if (finished && !visibleRef.current) setMounted(false);
    });
  }, [backdrop, openY]);

  const requestClose = useCallback(() => {
    if (!dismissibleRef.current) return;
    closeRef.current();
    animateOut();
  }, [animateOut]);

  // Derive mount state during render instead of an effect: a sheet that opens
  // must be in the tree before the entrance animation can run, and a sheet
  // that closes stays mounted until `animateOut` finishes.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible && !mounted) setMounted(true);
  }

  useEffect(() => {
    if (!visible) animateOut();
  }, [visible, animateOut]);

  // Wait for the Modal to mount before measuring/animation so the sheet never
  // flashes at its resting position on the first frame.
  useEffect(() => {
    if (!mounted || !visible) return;
    closingRef.current = false;
    openY.setValue(height);
    dragY.setValue(0);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(openY, {
        toValue: 0,
        damping: 22,
        stiffness: 230,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [mounted, visible, height, openY, dragY, backdrop]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          dismissibleRef.current && g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) {
            requestClose();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            speed: 22,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            speed: 22,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragY, requestClose],
  );

  const translateY = Animated.add(openY, dragY);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              marginBottom: Math.max(insets.bottom, spacing.sm),
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.grabZone}>
            <View style={styles.grabber} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: glass.overlay,
  },
  sheet: {
    marginHorizontal: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderRadius: sheetRadius,
    ...sheetShadow,
  },
  grabZone: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
});
