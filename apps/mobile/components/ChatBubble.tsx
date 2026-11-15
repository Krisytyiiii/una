import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

const BUBBLE_RADIUS = 18;
const TAIL_RADIUS = 6;
const AVATAR_SLOT = 30;

type Props = {
  mine: boolean;
  text: string;
  time: string;
  /** First bubble in a same-sender run — adds breathing room above. */
  first?: boolean;
  /** Last bubble in a run — shows the timestamp and squares off the tail. */
  last?: boolean;
  /** Avatar shown beside the last incoming bubble in a run. */
  avatar?: ReactNode;
};

/**
 * One chat message. Runs from the same sender are tightened into a stack
 * (small gap, single timestamp, only the last bubble gets a tail) so a burst
 * of replies reads as one thought instead of a wall of cards.
 */
export function ChatBubble({ mine, text, time, first = true, last = true, avatar }: Props) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const animatedStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
      },
    ],
  };

  return (
    <View
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        !first && (mine ? styles.tightMine : styles.tightTheirs),
      ]}
    >
      {!mine ? (
        <View style={styles.avatarSlot}>{last ? avatar ?? null : null}</View>
      ) : null}

      <Animated.View style={[styles.bubbleWrap, animatedStyle]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.mine : styles.theirs,
            mine && last && styles.mineTail,
            !mine && last && styles.theirsTail,
          ]}
        >
          <Text
            selectable
            style={[styles.text, mine ? styles.textMine : styles.textTheirs]}
          >
            {text}
          </Text>
          {last ? (
            <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
              {time}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  // Stacked bubbles from one sender sit closer together.
  tightMine: { marginTop: -1 },
  tightTheirs: { marginTop: -1 },
  avatarSlot: {
    width: AVATAR_SLOT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 1,
  },
  bubbleWrap: { maxWidth: '80%' },
  bubble: {
    borderRadius: BUBBLE_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  mine: { backgroundColor: colors.blue },
  mineTail: { borderBottomRightRadius: TAIL_RADIUS },
  theirs: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  theirsTail: { borderBottomLeftRadius: TAIL_RADIUS },
  text: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md + 6,
  },
  textMine: { color: colors.white },
  textTheirs: { color: colors.ink },
  time: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    marginTop: spacing.xs,
  },
  timeMine: { color: colors.white, opacity: 0.75, alignSelf: 'flex-end' },
  timeTheirs: { color: colors.muted, alignSelf: 'flex-end' },
});
