import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cancelAppointment, isWithinStudentRescheduleWindow } from '@dorsu/shared-services';
import type { AppointmentRow } from '@dorsu/shared-types';
import X from 'lucide-react-native/icons/x';
import Check from 'lucide-react-native/icons/check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Clock from 'lucide-react-native/icons/clock';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Info from 'lucide-react-native/icons/info';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Video from 'lucide-react-native/icons/video';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import {
  loadAppointmentUpdateInfo,
  type AppointmentUpdateInfo,
} from '@/lib/appointment-updates';
import {
  countdownLabel,
  dayParts,
  fullDate,
  modeLabel,
  timeRange,
  titleFor,
  weekdayDate,
} from '@/lib/session-format';
import {
  colors,
  cardShadow,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '@/theme';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckinResult, type CheckinSummary } from '@/components/CheckinResult';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { StatusChip } from '@/components/StatusChip';

type Props = {
  /** Appointment whose details are open (null closes the sheet). */
  appointment: AppointmentRow | null;
  /** Appointment awaiting cancel confirmation (null hides that sheet). */
  cancelTarget: AppointmentRow | null;
  counselorName?: string;
  counselorSpecialty?: string;
  /** Scored check-in linked to this session, when one exists. */
  checkinResult?: CheckinSummary | null;
  onClose: () => void;
  /** Parent closes this sheet and opens its shared `RescheduleModal`. */
  onRequestReschedule: (appointment: AppointmentRow) => void;
  onRequestCancel: (appointment: AppointmentRow) => void;
  onCancelClose: () => void;
  /** Parent patches/removes its own row after a successful cancel. */
  onCancelled?: (appointment: AppointmentRow) => void;
  /** Opens the shared chat thread. Hidden when the parent does not provide it. */
  onMessage?: () => void;
};

const ACTIVE = ['pending', 'assigned', 'confirmed'];
const TERMINAL = ['cancelled', 'rejected', 'no_show'];

const ROLE_LABEL: Record<string, string> = {
  counselor: 'Counselor',
  guidance_head: 'Guidance Head',
  admin: 'Admin',
  guidance_personnel: 'Guidance Personnel',
  faculty: 'Faculty',
};

const JOURNEY = ['Requested', 'Assigned', 'Confirmed', 'Completed'] as const;

/** Terminal copy so a closed session never reads like a live one. */
const TERMINAL_COPY: Record<string, { title: string; body: string }> = {
  cancelled: {
    title: 'This session was cancelled',
    body: 'You can book a new session whenever you are ready.',
  },
  rejected: {
    title: 'This request was not accepted',
    body: 'If you still need support, book another session or contact the Guidance Office.',
  },
  no_show: {
    title: 'This session was missed',
    body: 'Book a new session whenever you want to pick things back up.',
  },
};

/** One-line attribution for the update badge. */
function updateLabel(info: AppointmentUpdateInfo): string {
  if (info.isSelf) return 'Updated by you';
  if (info.name === 'Guidance Office') return 'Updated by the Guidance Office';
  const role = ROLE_LABEL[info.role];
  return role ? `Updated by ${info.name} · ${role}` : `Updated by ${info.name}`;
}

/** Only hand http(s) URLs to the OS so a bad row cannot open `javascript:`. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** 1-based progress: pending=1 (requested done), completed=4 (all done). */
function journeyProgress(status: string): number {
  if (status === 'pending') return 1;
  if (status === 'assigned') return 2;
  if (status === 'confirmed') return 3;
  if (status === 'completed') return 4;
  return 0;
}

function Journey({ status }: { status: string }) {
  const progress = journeyProgress(status);
  return (
    <View style={styles.journey}>
      {JOURNEY.map((label, index) => {
        const done = index < progress;
        const current = index === progress;
        const leftOn = index < progress;
        const rightOn = index + 1 < progress;
        return (
          <View key={label} style={styles.step}>
            <View style={styles.track}>
              <View
                style={[
                  styles.line,
                  leftOn && styles.lineOn,
                  index === 0 && styles.lineHidden,
                ]}
              />
              <View
                style={[
                  styles.node,
                  done && styles.nodeDone,
                  current && styles.nodeCurrent,
                ]}
              >
                {done ? (
                  <Check size={10} color={colors.white} strokeWidth={3} />
                ) : (
                  <Text style={[styles.nodeText, current && styles.nodeTextCurrent]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.line,
                  rightOn && styles.lineOn,
                  index === JOURNEY.length - 1 && styles.lineHidden,
                ]}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.stepLabel,
                done && styles.stepLabelDone,
                current && styles.stepLabelCurrent,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Student session details + cancel confirmation, shared by Home and the
 * Sessions tab so both surfaces stay identical. Both surfaces are floating
 * bottom sheets: swipe down (grabber), tap the backdrop, or use the close
 * control. Cancel is a separate red-action sheet.
 *
 * Layout: fixed header + "when" hero, scrolling journey/people/links, then a
 * fixed action footer so reschedule/cancel never hide under long content.
 */
export function SessionDetailsModal({
  appointment,
  cancelTarget,
  counselorName,
  counselorSpecialty,
  checkinResult,
  onClose,
  onRequestReschedule,
  onRequestCancel,
  onCancelClose,
  onCancelled,
  onMessage,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updateInfo, setUpdateInfo] = useState<AppointmentUpdateInfo | null>(null);
  const [updateInfoFor, setUpdateInfoFor] = useState<string | null>(null);

  // Keep the last non-null rows so the sheet body does not collapse while the
  // exit animation is still playing (the parent clears the prop immediately).
  const [lastAppointment, setLastAppointment] = useState<AppointmentRow | null>(appointment);
  const [lastCancel, setLastCancel] = useState<AppointmentRow | null>(cancelTarget);
  if (appointment && appointment !== lastAppointment) setLastAppointment(appointment);
  if (cancelTarget && cancelTarget !== lastCancel) setLastCancel(cancelTarget);
  const shownAppointment = appointment ?? lastAppointment;
  const shownCancel = cancelTarget ?? lastCancel;

  const appointmentId = appointment?.id ?? null;
  const appointmentUpdatedAt = appointment?.updated_at ?? null;

  // Attribution is fetched when the sheet opens and again whenever the row's
  // updated_at changes (e.g. after a reschedule), so the badge never shows a
  // stale actor. Failures leave the badge hidden.
  useEffect(() => {
    if (!appointmentId) return;
    let alive = true;
    void (async () => {
      const info = await loadAppointmentUpdateInfo(getSupabase(), appointmentId);
      if (!alive) return;
      setUpdateInfo(info);
      setUpdateInfoFor(appointmentId);
    })();
    return () => {
      alive = false;
    };
  }, [appointmentId, appointmentUpdatedAt]);

  const update = updateInfoFor === (shownAppointment?.id ?? null) ? updateInfo : null;
  const wasUpdated =
    update !== null &&
    shownAppointment !== null &&
    new Date(update.updatedAt).getTime() >
      new Date(shownAppointment.created_at).getTime() + 1000;

  const nowMs = new Date().getTime();
  const active =
    shownAppointment !== null &&
    ACTIVE.includes(shownAppointment.status) &&
    new Date(shownAppointment.scheduled_at).getTime() >= nowMs;
  const canReschedule =
    active &&
    (shownAppointment.status === 'pending' ||
      shownAppointment.status === 'assigned' ||
      (shownAppointment.status === 'confirmed' &&
        isWithinStudentRescheduleWindow(shownAppointment.scheduled_at)));

  const terminal =
    shownAppointment !== null && TERMINAL.includes(shownAppointment.status);
  const terminalCopy = terminal
    ? TERMINAL_COPY[shownAppointment!.status]
    : undefined;
  const confirmed = shownAppointment?.status === 'confirmed';
  const meetUrl = shownAppointment?.meeting_url?.trim() ?? '';
  const hasMeet = meetUrl !== '' && isHttpUrl(meetUrl);

  const openMeet = () => {
    if (!hasMeet) return;
    // openURL rejects on devices without a handler; the link stays visible so
    // the student can still copy it manually.
    void Linking.openURL(meetUrl).catch(() => undefined);
  };

  const doCancel = async () => {
    if (!cancelTarget || busy) return;
    setError('');
    setBusy(true);
    try {
      await cancelAppointment(getSupabase(), cancelTarget.id);
      onCancelled?.(cancelTarget);
      onCancelClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not cancel the session.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BottomSheet
        visible={appointment !== null}
        onClose={onClose}
        accessibilityLabel="Close session details"
      >
        {shownAppointment ? (
          <View style={styles.body}>
            <View style={styles.headRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>YOUR SESSION</Text>
                <Text style={styles.title}>{titleFor(shownAppointment)}</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close session details"
                style={styles.closeBtn}
              >
                <X size={16} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.badgeRow}>
              <StatusChip status={shownAppointment.status} />
              <View style={styles.modePill}>
                {shownAppointment.mode === 'online' ? (
                  <Video size={11} color={colors.blue} />
                ) : (
                  <MapPin size={11} color={colors.blue} />
                )}
                <Text style={styles.modeText} numberOfLines={1}>
                  {shownAppointment.mode === 'online' ? 'Online' : 'In person'}
                </Text>
              </View>
              {update !== null && wasUpdated ? (
                <View style={styles.updateBadge}>
                  <Info size={10} color={colors.warn} />
                  <Text style={styles.updateBadgeText} numberOfLines={1}>
                    {updateLabel(update)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.hero}>
              <View pointerEvents="none" style={styles.heroGlow} />
              <View style={styles.dateBlock}>
                <Text style={styles.dateMonth}>{dayParts(shownAppointment.scheduled_at).month}</Text>
                <Text style={styles.dateDay}>{dayParts(shownAppointment.scheduled_at).day}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.heroWeekday} numberOfLines={1}>
                  {weekdayDate(shownAppointment.scheduled_at)}
                </Text>
                <View style={styles.heroTimeRow}>
                  <Clock size={13} color={colors.ink} />
                  <Text style={styles.heroTime}>{timeRange(shownAppointment)}</Text>
                </View>
              </View>
              {active ? (
                <View style={styles.countdown}>
                  <Text style={styles.countdownText}>
                    {countdownLabel(shownAppointment.scheduled_at)}
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {terminal && terminalCopy ? (
                <View style={styles.terminalCard}>
                  <CircleX size={16} color={colors.danger} />
                  <View style={styles.flex}>
                    <Text style={styles.terminalTitle}>{terminalCopy.title}</Text>
                    <Text style={styles.terminalBody}>{terminalCopy.body}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SESSION JOURNEY</Text>
                  <Journey status={shownAppointment.status} />
                </View>
              )}

              {/* The student's own scored check-in. Shown alongside the
                  journey so the card and this sheet always agree. */}
              {checkinResult ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>YOUR CHECK-IN</Text>
                  <CheckinResult summary={checkinResult} />
                  <View style={styles.noteRow}>
                    <Info size={12} color={colors.muted} />
                    <Text style={styles.note}>
                      Shared with your counselor so they can prepare. This is a stress
                      snapshot, not a diagnosis.
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.personCard}>
                <InitialsAvatar
                  name={
                    shownAppointment.counselor_id
                      ? (counselorName ?? 'Assigned counselor')
                      : 'Guidance Office'
                  }
                  size={44}
                  tone={shownAppointment.counselor_id ? undefined : colors.muted}
                />
                <View style={styles.flex}>
                  <Text style={styles.personLabel}>ASSIGNED COUNSELOR</Text>
                  <Text style={styles.personName} numberOfLines={1}>
                    {shownAppointment.counselor_id
                      ? (counselorName ?? 'Assigned counselor')
                      : 'Awaiting assignment'}
                  </Text>
                  <Text style={styles.personSub} numberOfLines={2}>
                    {shownAppointment.counselor_id
                      ? (counselorSpecialty ?? 'Guidance counselor')
                      : 'The guidance head assigns one after your request'}
                  </Text>
                </View>
                {onMessage && active && confirmed ? (
                  <Pressable
                    onPress={onMessage}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Message your counselor"
                    style={({ pressed }) => [styles.messageBtn, pressed && styles.pressed]}
                  >
                    <MessageCircle size={16} color={colors.blue} />
                  </Pressable>
                ) : null}
              </View>

              {shownAppointment.mode === 'online' ? (
                hasMeet ? (
                  <Pressable
                    onPress={openMeet}
                    accessibilityRole="link"
                    accessibilityLabel="Open the Google Meet link"
                    style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}
                  >
                    <View style={styles.linkIcon}>
                      <Video size={16} color={colors.white} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.linkLabel}>GOOGLE MEET</Text>
                      <Text style={styles.linkValue} numberOfLines={1}>
                        {meetUrl}
                      </Text>
                    </View>
                    <ExternalLink size={15} color={colors.blue} />
                  </Pressable>
                ) : (
                  <View style={styles.linkCard}>
                    <View style={[styles.linkIcon, styles.linkIconMuted]}>
                      <Video size={16} color={colors.muted} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.linkLabel}>VIDEO CALL</Text>
                      <Text style={styles.linkValue} numberOfLines={2}>
                        The Meet link appears here once your counselor confirms.
                      </Text>
                    </View>
                  </View>
                )
              ) : null}

              <View style={styles.tileRow}>
                <Tile
                  label="REFERENCE"
                  value={shownAppointment.id.slice(0, 8).toUpperCase()}
                />
                <Tile label="BOOKED ON" value={fullDate(shownAppointment.created_at)} />
              </View>

              {shownAppointment.counselor_id === null && !terminal ? (
                <View style={styles.noteRow}>
                  <Info size={12} color={colors.muted} />
                  <Text style={styles.note}>
                    Their name will appear here once the guidance head assigns a counselor.
                  </Text>
                </View>
              ) : null}

              {confirmed ? (
                <View style={styles.noteRow}>
                  <Info size={12} color={colors.muted} />
                  <Text style={styles.note}>
                    {canReschedule
                      ? 'You can still move this session until 24 hours before it starts.'
                      : 'This session starts within 24 hours. Contact the Guidance Office if you need to move it.'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.locationRow}>
                {shownAppointment.mode === 'online' ? (
                  <Video size={12} color={colors.blue} />
                ) : (
                  <MapPin size={12} color={colors.blue} />
                )}
                <Text style={styles.locationText}>{modeLabel(shownAppointment)}</Text>
              </View>
            </ScrollView>

            {active ? (
              <View style={styles.footer}>
                {canReschedule ? (
                  <Button
                    label="Reschedule"
                    variant="outline"
                    style={styles.flex}
                    onPress={() => onRequestReschedule(shownAppointment)}
                  />
                ) : null}
                <Button
                  label="Cancel session"
                  variant="dangerOutline"
                  style={styles.flex}
                  onPress={() => onRequestCancel(shownAppointment)}
                />
              </View>
            ) : null}

            <Text style={styles.hint}>Drag down or tap outside to close</Text>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={cancelTarget !== null}
        onClose={() => {
          if (!busy) onCancelClose();
        }}
        dismissible={!busy}
        accessibilityLabel="Dismiss cancel confirmation"
      >
        {shownCancel ? (
          <View style={styles.body}>
            <View style={styles.headRow}>
              <Text style={styles.title}>Cancel this session?</Text>
              <Pressable
                onPress={() => {
                  if (!busy) onCancelClose();
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Dismiss cancel confirmation"
                style={styles.closeBtn}
              >
                <X size={16} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.warnCard}>
              <Text style={styles.warnTitle}>{titleFor(shownCancel)}</Text>
              <Text style={styles.warnMeta}>
                {weekdayDate(shownCancel.scheduled_at)} · {timeRange(shownCancel)}
              </Text>
            </View>

            <Text style={styles.note}>
              This can’t be undone. You can book a new session anytime.
            </Text>

            {error !== '' ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.btns}>
              <Button
                label="Keep session"
                variant="outline"
                disabled={busy}
                style={styles.flex}
                onPress={onCancelClose}
              />
              <Button
                label={busy ? 'Cancelling…' : 'Yes, cancel'}
                variant="danger"
                disabled={busy}
                style={styles.flex}
                onPress={() => void doCancel()}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  /* ------------------------------- header ------------------------------- */

  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    color: colors.ink,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    backgroundColor: colors.chip,
    paddingHorizontal: spacing.sm,
    height: spacing.lg,
  },
  modeText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
  },
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warnSoft,
    backgroundColor: colors.warnSoft,
    paddingHorizontal: spacing.sm,
    height: spacing.lg,
  },
  updateBadgeText: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.warn,
  },

  /* -------------------------------- hero -------------------------------- */

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.sky,
    borderRadius: radius + 12,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.sun,
    opacity: 0.24,
  },
  dateBlock: {
    width: 54,
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    ...cardShadow,
  },
  dateMonth: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.blue,
  },
  dateDay: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 28,
    color: colors.ink,
  },
  heroWeekday: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  heroTime: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.blue,
  },
  countdown: {
    borderRadius: 999,
    backgroundColor: colors.sun,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  countdownText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
  },

  /* ------------------------------- scroll ------------------------------- */

  scroll: { flexShrink: 1 },
  scrollContent: { paddingTop: spacing.xs, gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },

  /* ------------------------------ journey ------------------------------- */

  journey: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius + 8,
    backgroundColor: colors.chip,
  },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  lineOn: { backgroundColor: colors.blue },
  lineHidden: { backgroundColor: 'transparent' },
  node: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  nodeCurrent: {
    borderColor: colors.sun,
    backgroundColor: colors.sunSoft,
  },
  nodeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    color: colors.muted,
  },
  nodeTextCurrent: { color: colors.ink },
  stepLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  stepLabelDone: { color: colors.blue },
  stepLabelCurrent: { fontFamily: fontFamily.bold, color: colors.ink },

  /* ------------------------------ terminal ------------------------------ */

  terminalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius + 8,
    padding: spacing.md,
  },
  terminalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  terminalBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.ink,
  },

  /* ------------------------------- person ------------------------------- */

  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius + 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  personLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  personName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  personSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* -------------------------------- link -------------------------------- */

  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.sky,
    borderRadius: radius + 8,
    padding: spacing.sm,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconMuted: { backgroundColor: colors.chip },
  linkLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.blue,
  },
  linkValue: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.ink,
  },

  /* -------------------------------- tiles ------------------------------- */

  tileRow: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    gap: 2,
    backgroundColor: colors.chip,
    borderRadius: radius + 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tileLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  tileValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.ink,
  },

  /* -------------------------------- notes ------------------------------- */

  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  note: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.muted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    flexShrink: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.muted,
  },

  /* ------------------------------- footer ------------------------------- */

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.creamLine,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  /* ------------------------------- cancel ------------------------------- */

  error: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  warnCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius + 8,
    padding: spacing.md,
    gap: 2,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  warnTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  warnMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
