import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { colors, fontFamily, fontSize, spacing, cardShadow } from '@/theme';
import { PressableScale } from '@/components/PressableScale';
import { InitialsAvatar } from '@/components/InitialsAvatar';

type Props = {
  name: string;
  /** Specialization or a short relationship hint ("From your session"). */
  subtitle: string;
  preview: string;
  /** Bold prefix for the student's own last message. */
  previewPrefix?: string;
  time: string;
  unread?: boolean;
  closed?: boolean;
  busy?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
};

/**
 * Inbox card. One card per counselor (or leftover conversation) with the
 * monogram, specialty, last message and recency in a single scannable row.
 * Unread cards lift off the page and bold their preview so a reply from the
 * office is impossible to miss.
 */
export function ConversationCard({
  name,
  subtitle,
  preview,
  previewPrefix,
  time,
  unread = false,
  closed = false,
  busy = false,
  onPress,
  accessibilityHint,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${name}${unread ? ', unread' : ''}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: busy }}
      style={[styles.card, unread && styles.cardUnread]}
    >
      <InitialsAvatar name={name} size={46} dot={unread} />

      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text>
        </View>

        <Text style={[styles.subtitle, unread && styles.subtitleUnread]} numberOfLines={1}>
          {subtitle}
        </Text>

        <View style={styles.bottom}>
          <Text
            style={[styles.preview, unread && styles.previewUnread]}
            numberOfLines={1}
          >
            {previewPrefix ? <Text style={styles.previewMine}>{previewPrefix}</Text> : null}
            {preview}
          </Text>

          {busy ? (
            <ActivityIndicator color={colors.blue} />
          ) : closed ? (
            <View style={styles.closedPill}>
              <Text style={styles.closedText}>Closed</Text>
            </View>
          ) : (
            <View style={styles.chevron}>
              <ChevronRight
                size={14}
                strokeWidth={unread ? 2.6 : 2}
                color={unread ? colors.white : colors.blue}
              />
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...cardShadow,
  },
  cardUnread: {
    borderColor: colors.sky,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  nameUnread: { color: colors.ink },
  time: { fontFamily: fontFamily.medium, fontSize: fontSize.xxs, color: colors.muted },
  timeUnread: { color: colors.blue, fontFamily: fontFamily.bold },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  subtitleUnread: { color: colors.blue, fontFamily: fontFamily.medium },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  preview: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  previewUnread: { color: colors.ink, fontFamily: fontFamily.medium },
  previewMine: { fontFamily: fontFamily.medium, color: colors.muted },
  chevron: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chip,
  },
  closedPill: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    backgroundColor: colors.disabledBg,
  },
  closedText: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.muted },
});
