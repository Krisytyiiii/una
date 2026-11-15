import { StyleSheet, Text, View } from 'react-native';
import Activity from 'lucide-react-native/icons/activity';
import { PSS10_BANDS } from '@dorsu/shared-services';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export type PssBand = 'low' | 'moderate' | 'high';

/** Newest check-in linked to one appointment (booking gate or pre-session). */
export type CheckinSummary = {
  /** Submission time — shown as a short date. */
  at: string;
  totalScore: number;
  band: PssBand;
};

export function isPssBand(value: unknown): value is PssBand {
  return value === 'low' || value === 'moderate' || value === 'high';
}

export function bandLabel(band: PssBand): string {
  return PSS10_BANDS[band].label;
}

/** High stress stays amber — red is reserved for sessions that ended badly. */
const TONE: Record<PssBand, { bg: string; text: string; dot: string }> = {
  low: { bg: colors.successSoft, text: colors.success, dot: colors.success },
  moderate: { bg: colors.warnSoft, text: colors.warn, dot: colors.warn },
  high: { bg: colors.warnSoft, text: colors.warn, dot: colors.danger },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * The student's own PSS-10 result for one session. Printed in plain language
 * (band + total out of 40) with no diagnostic framing — it is a snapshot the
 * counselor reads, not a verdict the student should self-treat from.
 */
export function CheckinResult({
  summary,
  onDark = false,
}: {
  summary: CheckinSummary;
  onDark?: boolean;
}) {
  const tone = TONE[summary.band];
  return (
    <View style={[styles.row, onDark ? styles.rowOnDark : { backgroundColor: tone.bg }]}>
      <View style={[styles.icon, onDark && styles.iconOnDark]}>
        <Activity size={13} color={onDark ? colors.sun : tone.dot} />
      </View>
      <View style={styles.flex}>
        <Text
          numberOfLines={1}
          style={[styles.band, onDark ? styles.textOnDark : { color: tone.text }]}
        >
          {bandLabel(summary.band)}
        </Text>
        <Text style={[styles.meta, onDark && styles.metaOnDark]}>
          Check-in · {shortDate(summary.at)}
        </Text>
      </View>
      <View style={[styles.score, onDark && styles.scoreOnDark]}>
        <Text style={[styles.scoreValue, onDark && styles.textOnDark]}>
          {summary.totalScore}
          <Text style={[styles.scoreMax, onDark && styles.metaOnDark]}>/40</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius + 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowOnDark: { backgroundColor: colors.blueDark },
  flex: { flex: 1 },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  iconOnDark: { backgroundColor: colors.blue },
  band: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  textOnDark: { color: colors.white },
  meta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  metaOnDark: { color: colors.sky },
  score: {
    minWidth: 46,
    alignItems: 'center',
    borderRadius: radius + 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  scoreOnDark: { backgroundColor: colors.blue },
  scoreValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  scoreMax: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
});
