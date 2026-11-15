import { StyleSheet, Text, TextInput, View } from 'react-native';
import Send from 'lucide-react-native/icons/send';
import { colors, fontFamily, fontSize, spacing, cardShadow } from '@/theme';
import { PressableScale } from '@/components/PressableScale';
import { TAB_BAR_BASE } from '@/components/TabBar';

const MAX_LENGTH = 4000;
const COUNTER_AT = 3400;

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
};

/**
 * Floating composer. The input grows with the draft (up to ~5 lines) while the
 * send button stays anchored to the bottom edge, so long messages never push
 * the action out of reach. Sits above the floating tab dock.
 */
export function Composer({ value, onChangeText, onSend, sending, disabled }: Props) {
  const canSend = !sending && !disabled && value.trim() !== '';

  return (
    <View style={styles.wrap}>
      <View style={[styles.shell, !canSend && styles.shellIdle]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Write a message…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
          maxLength={MAX_LENGTH}
          editable={!sending && !disabled}
          accessibilityLabel="Message input"
          textAlignVertical="center"
        />

        <PressableScale
          onPress={onSend}
          disabled={!canSend}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          style={[styles.send, canSend ? styles.sendOn : styles.sendOff]}
        >
          <Send size={17} color={canSend ? colors.white : colors.disabledText} />
        </PressableScale>
      </View>

      {value.length >= COUNTER_AT ? (
        <Text style={styles.counter}>
          {value.length}/{MAX_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    // Leave room for the floating TabBar rendered over the screen.
    marginBottom: TAB_BAR_BASE + spacing.xs,
    gap: 2,
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.creamLine,
    ...cardShadow,
    shadowOpacity: 0.1,
  },
  shellIdle: { borderColor: colors.border },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 112,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: 0,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md + 6,
    color: colors.ink,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOn: {
    backgroundColor: colors.blue,
    shadowColor: colors.blueDark,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sendOff: { backgroundColor: colors.chip },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    color: colors.muted,
    paddingRight: spacing.md,
  },
});
