import { StyleSheet, Text, View } from 'react-native';
import type { AppointmentRow } from '@dorsu/shared-types';
import type { PreSessionPss10State } from '@dorsu/shared-services';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheckBig from 'lucide-react-native/icons/circle-check-big';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Clock from 'lucide-react-native/icons/clock';
import Info from 'lucide-react-native/icons/info';
import MapPin from 'lucide-react-native/icons/map-pin';
import Star from 'lucide-react-native/icons/star';
import Video from 'lucide-react-native/icons/video';
import {
  colors,
  cardRadius,
  cardShadow,
  floatingShadow,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '@/theme';
import { Button } from '@/components/Button';
import { CheckinResult, type CheckinSummary } from '@/components/CheckinResult';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { PressableScale } from '@/components/PressableScale';
import { StarRating } from '@/components/StarRating';
import { StatusChip } from '@/components/StatusChip';
import { countdownLabel, dayParts, modeLabel, titleFor } from '@/lib/session-format';

type Props = {
  appointment: AppointmentRow;
  counselorName?: string;
  counselorSpecialty?: string;
  /** `preSessionPss10State(...)` for this row. */
  checkinState: PreSessionPss10State;
  /** Timestamp of the newest linked check-in, when one exists. */
  checkinAt?: string;
  /** The student's own scored check-in for this session, when one is linked. */
  checkinResult?: CheckinSummary;
  /** Submitted star rating, when the student already rated this session. */
  rating?: number;
  /** In-progress rating selection (not yet submitted). */
  draftRating?: number;
  ratingBusy?: boolean;
  /** Confirmed/pending/assigned AND still in the future. */
  active: boolean;
  canReschedule: boolean;
  /** Renders the deep-blue "next up" treatment. */
  featured?: boolean;
  onOpen: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onCheckin: () => void;
  onMessage: () => void;
  onDraftRating: (value: number) => void;
  onSubmitRating: () => void;
};

/**
 * One student session card, shared by every tab. Leads with the date badge and
 * the session title, then the counselor, then only the actions that apply
 * (check-in, message, reschedule, cancel, rating). The first upcoming session
 * uses the deep-blue `featured` treatment with a countdown.
 */
export function SessionCard({
  appointment,
  counselorName,
  counselorSpecialty,
  checkinState,
  checkinAt,
  checkinResult,
  rating,
  draftRating,
  ratingBusy = false,
  active,
  canReschedule,
  featured = false,
  onOpen,
  onReschedule,
  onCancel,
  onCheckin,
  onMessage,
  onDraftRating,
  onSubmitRating,
}: Props) {
  const parts = dayParts(appointment.scheduled_at);
  const onDark = featured;
  const confirmed = appointment.status === 'confirmed';
  const needsCheckin =
    active && confirmed && (checkinState === 'missing' || checkinState === 'expired');
  const checkinDone = confirmed && checkinState === 'complete';
  const counselorLabel = appointment.counselor_id
    ? counselorName ?? 'Assigned counselor'
    : 'Awaiting counselor';

  return (
    <PressableScale
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${titleFor(appointment)}, ${appointment.status.replace(/_/g, ' ')}`}
      accessibilityHint="Opens session details"
      style={[styles.card, featured && styles.cardFeatured]}
    >
      {featured ? (
        <View pointerEvents="none" style={styles.decor}>
          <View style={styles.glow} />
          <View style={styles.ring} />
        </View>
      ) : null}

      {featured ? (
        <View style={styles.featuredTop}>
          <View style={styles.nextPill}>
            <View style={styles.nextDot} />
            <Text style={styles.nextPillText}>NEXT UP</Text>
          </View>
          <StatusChip status={appointment.status} />
        </View>
      ) : null}

      <View style={styles.top}>
        <View style={[styles.dateBadge, onDark && styles.dateBadgeOnDark]}>
          <Text style={[styles.dateMonth, onDark && styles.dateMonthOnDark]}>{parts.month}</Text>
          <Text style={[styles.dateDay, onDark && styles.onDarkText]}>{parts.day}</Text>
        </View>

        <View style={styles.headText}>
          <Text numberOfLines={2} style={[styles.title, onDark && styles.onDarkText]}>
            {titleFor(appointment)}
          </Text>
          <Text style={[styles.when, onDark && styles.whenOnDark]}>
            {parts.weekday} · {parts.time}
          </Text>
        </View>

        {featured ? (
          <ChevronRight size={16} color={colors.white} />
        ) : (
          <StatusChip status={appointment.status} />
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          {appointment.mode === 'online' ? (
            <Video size={12} color={onDark ? colors.sun : colors.blue} />
          ) : (
            <MapPin size={12} color={onDark ? colors.sun : colors.blue} />
          )}
          <Text style={[styles.metaText, onDark && styles.metaTextOnDark]}>
            {modeLabel(appointment)}
          </Text>
        </View>
        {featured ? (
          <View style={styles.countdown}>
            <Clock size={11} color={colors.ink} />
            <Text style={styles.countdownText}>
              {countdownLabel(appointment.scheduled_at)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.counselorRow, onDark && styles.counselorRowOnDark]}>
        <InitialsAvatar
          name={counselorLabel}
          size={28}
          tone={onDark ? colors.blueDark : undefined}
        />
        <View style={styles.flex}>
          <Text
            numberOfLines={1}
            style={[styles.counselorName, onDark && styles.onDarkText]}
          >
            {counselorLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.counselorSub, onDark && styles.counselorSubOnDark]}
          >
            {appointment.counselor_id
              ? counselorSpecialty ?? 'Guidance counselor'
              : 'The guidance head assigns one after your request'}
          </Text>
        </View>
      </View>

      {checkinDone && !checkinResult ? (
        <View style={[styles.okRow, onDark && styles.okRowOnDark]}>
          <CircleCheckBig size={13} color={onDark ? colors.sun : colors.success} />
          <Text style={[styles.okText, onDark && styles.okTextOnDark]}>
            Pre-session check-in complete
            {checkinAt
              ? ` · ${new Date(checkinAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}`
              : ''}
          </Text>
        </View>
      ) : null}

      {/* The student's own scored result — shown for upcoming and past
          sessions alike so the care record on screen matches the one their
          counselor reads. Never sent through notifications. */}
      {checkinResult ? <CheckinResult summary={checkinResult} onDark={onDark} /> : null}

      {needsCheckin ? (
        <View style={[styles.alert, onDark && styles.alertOnDark]}>
          <View style={styles.alertHead}>
            <CircleAlert size={14} color={onDark ? colors.sun : colors.warn} />
            <Text style={[styles.alertTitle, onDark && styles.alertTitleOnDark]}>
              {checkinState === 'expired' ? 'Check-in expired' : 'Check-in needed'}
            </Text>
          </View>
          <Text style={[styles.alertText, onDark && styles.alertTextOnDark]}>
            {checkinState === 'expired'
              ? 'Your last check-in is older than 7 days. Complete a fresh one before this session.'
              : 'A short check-in helps your counselor prepare for this session.'}
          </Text>
          {!featured ? (
            <View style={styles.alertAction}>
              <Button label="Pre-session check-in" onPress={onCheckin} />
            </View>
          ) : null}
        </View>
      ) : null}

      {active && confirmed && appointment.mode === 'online' && appointment.meeting_url ? (
        <View style={styles.videoPill}>
          <Video size={12} color={colors.blue} />
          <Text style={styles.videoText}>Video link is ready in your confirmation</Text>
        </View>
      ) : null}

      {featured ? (
        <View style={styles.actions}>
          <Button
            label="View details"
            variant="ghostOnDark"
            onPress={onOpen}
            style={styles.flex}
          />
          {needsCheckin ? (
            <Button label="Check in" variant="accent" onPress={onCheckin} style={styles.flex} />
          ) : active && confirmed ? (
            <Button label="Message" variant="accent" onPress={onMessage} style={styles.flex} />
          ) : null}
        </View>
      ) : null}

      {!featured && active && confirmed ? (
        <View style={styles.mt}>
          <Button label="Message counselor" onPress={onMessage} />
        </View>
      ) : null}

      {!featured && active ? (
        <View style={styles.btnRow}>
          {canReschedule ? (
            <Button
              label="Reschedule"
              variant="outline"
              onPress={onReschedule}
              style={styles.flex}
            />
          ) : null}
          <Button
            label="Cancel"
            variant="dangerOutline"
            onPress={onCancel}
            style={styles.flex}
          />
        </View>
      ) : null}

      {!featured && active && confirmed && !canReschedule ? (
        <View style={styles.noteRow}>
          <Info size={12} color={colors.muted} />
          <Text style={styles.note}>
            Starts within 24 hours — contact the Guidance Office to move it.
          </Text>
        </View>
      ) : null}

      {!featured && appointment.status === 'completed' ? (
        <View style={styles.rate}>
          <View style={styles.rateHead}>
            <Star size={13} color={colors.sun} fill={colors.sun} />
            <Text style={styles.rateTitle}>How did this session feel?</Text>
          </View>

          {rating !== undefined ? (
            <View style={styles.ratedPill}>
              <Text style={styles.ratedText}>You rated this session</Text>
              <Text style={styles.ratedValue}>{rating}★</Text>
            </View>
          ) : (
            <>
              <StarRating
                value={draftRating ?? 0}
                onChange={onDraftRating}
                size={24}
              />
              <View style={styles.mt}>
                <Button
                  label={ratingBusy ? 'Sending…' : 'Submit rating'}
                  disabled={!draftRating || ratingBusy}
                  onPress={onSubmitRating}
                />
              </View>
            </>
          )}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  cardFeatured: {
    borderRadius: cardRadius + 6,
    backgroundColor: colors.blue,
    borderWidth: 0,
    padding: spacing.lg,
    ...floatingShadow,
    shadowOpacity: 0.2,
  },
  decor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: cardRadius + 6,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.sun,
    opacity: 0.22,
  },
  ring: {
    position: 'absolute',
    bottom: -50,
    left: -28,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 18,
    borderColor: colors.blueDark,
    opacity: 0.55,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.xs,
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.blueDark,
    borderRadius: radius + 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  nextDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun },
  nextPillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.white,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateBadge: {
    width: 48,
    borderRadius: radius + 8,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: 0,
  },
  dateBadgeOnDark: { backgroundColor: colors.blueDark },
  dateMonth: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  dateMonthOnDark: { color: colors.sky },
  dateDay: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 6,
    color: colors.ink,
  },
  headText: { flex: 1, gap: 1 },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  when: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  whenOnDark: { color: colors.sky },
  onDarkText: { color: colors.white },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: {
    flexShrink: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  metaTextOnDark: { color: colors.sky },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.sun,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countdownText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
  },
  counselorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.creamLine,
  },
  counselorRowOnDark: { borderTopColor: colors.blueDark },
  counselorName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  counselorSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  counselorSubOnDark: { color: colors.sky },
  okRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  okRowOnDark: { backgroundColor: colors.blueDark },
  okText: {
    flexShrink: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.success,
  },
  okTextOnDark: { color: colors.white },
  alert: {
    gap: spacing.xs,
    backgroundColor: colors.warnSoft,
    borderRadius: radius + 6,
    padding: spacing.sm,
  },
  alertOnDark: { backgroundColor: colors.blueDark },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  alertTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  alertTitleOnDark: { color: colors.white },
  alertText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.ink,
  },
  alertTextOnDark: { color: colors.sky },
  alertAction: { marginTop: spacing.xs },
  videoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.sky,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  videoText: {
    flexShrink: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.blue,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  note: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.muted,
  },
  rate: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.creamLine,
  },
  rateHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rateTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  ratedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.sunSoft,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  ratedText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  ratedValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  mt: { marginTop: spacing.xs },
  flex: { flex: 1 },
});
