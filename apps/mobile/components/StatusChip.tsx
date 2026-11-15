import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

type Tone = {
  label: string;
  /** Pill fill. */
  bg: string;
  /** Label colour — always the readable partner of `bg`. */
  fg: string;
  /** Leading dot, so meaning survives greyscale/colour-blind viewing. */
  dot: string;
};

/**
 * DB statuses (`appointments.status`) with student-facing labels. Kept as a
 * plain string map so realtime/refresh rows from Supabase render without casts.
 *
 * Colours follow one rule so the badge always matches its label:
 *   awaiting someone → amber · in progress/booked → blue · finished well →
 *   green · neutral/ended → grey · rejected/no-show → red.
 */
const TONES: Record<string, Tone> = {
  pending: { label: 'Pending', bg: colors.warnSoft, fg: colors.warn, dot: colors.sun },
  assigned: { label: 'Assigned', bg: colors.chip, fg: colors.ink, dot: colors.blue },
  confirmed: { label: 'Confirmed', bg: colors.sky, fg: colors.blue, dot: colors.blue },
  completed: { label: 'Completed', bg: colors.successSoft, fg: colors.success, dot: colors.success },
  cancelled: { label: 'Cancelled', bg: colors.disabledBg, fg: colors.muted, dot: colors.disabledText },
  rejected: { label: 'Rejected', bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
  no_show: { label: 'No-show', bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
};

const FALLBACK: Tone = {
  label: 'Update',
  bg: colors.disabledBg,
  fg: colors.muted,
  dot: colors.disabledText,
};

export function StatusChip({ status }: { status: string }) {
  const tone = TONES[status] ?? {
    ...FALLBACK,
    label: status.replace(/_/g, ' '),
  };
  return (
    <View style={[styles.base, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>
        {tone.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    height: spacing.lg,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
});
