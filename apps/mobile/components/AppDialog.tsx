import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, cardRadius, fontFamily, fontSize, spacing } from '@/theme';
import { Button } from '@/components/Button';

export type DialogActionVariant = 'primary' | 'outline' | 'danger' | 'dangerOutline';

export type DialogAction = {
  label: string;
  variant?: DialogActionVariant;
  /** Runs after the dialog has closed. */
  onPress?: () => void;
};

/**
 * Content for one custom dialog. The app deliberately never uses the native
 * `Alert`: it cannot be themed, looks foreign on the cream/ink/sun surfaces,
 * and on web it silently does nothing. Screens keep a `DialogSpec | null` in
 * state and render it with `<AppDialog />`.
 */
export type DialogSpec = {
  title: string;
  message?: string;
  /** Small line under the message, e.g. a privacy reassurance. */
  note?: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger' | 'success';
  /** Rendered top-to-bottom. The last action is usually the safe way out. */
  actions: DialogAction[];
};

type Props = {
  dialog: DialogSpec | null;
  onClose: () => void;
  /** Blocks backdrop and Android-back dismissal while a write is in flight. */
  dismissible?: boolean;
};

const TONE_BG = {
  default: colors.chip,
  danger: colors.dangerSoft,
  success: colors.successSoft,
} as const;

/**
 * Modal replacement for `Alert.alert`. Keeps the last spec mounted while the
 * native fade-out plays so the card never flashes empty.
 */
export function AppDialog({ dialog, onClose, dismissible = true }: Props) {
  const open = dialog !== null;
  const appear = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<DialogSpec | null>(dialog);

  if (dialog && dialog !== shown) setShown(dialog);
  const content = dialog ?? shown;

  useEffect(() => {
    if (!open) return;
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear, open]);

  if (!content) return null;

  const tone = content.tone ?? 'default';

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissible) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissible ? onClose : undefined}
          disabled={!dismissible}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [
                {
                  scale: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {content.icon ? (
            <View style={[styles.iconBubble, { backgroundColor: TONE_BG[tone] }]}>
              {content.icon}
            </View>
          ) : null}

          <View style={styles.copy}>
            <Text style={styles.title}>{content.title}</Text>
            {content.message ? <Text style={styles.message}>{content.message}</Text> : null}
            {content.note ? <Text style={styles.note}>{content.note}</Text> : null}
          </View>

          <View style={styles.actions}>
            {content.actions.map((action, index) => (
              <Button
                key={`${action.label}-${index}`}
                label={action.label}
                variant={action.variant ?? 'primary'}
                onPress={() => {
                  // Close first so an action that opens another dialog or
                  // screen cannot be overwritten by this one re-rendering.
                  onClose();
                  action.onPress?.();
                }}
                style={styles.action}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(16,34,64,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: cardRadius + 8,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: spacing.xs },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 5,
    color: colors.ink,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm + 6,
    color: colors.muted,
  },
  note: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 5,
    color: colors.muted,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  action: { height: 46 },
});
