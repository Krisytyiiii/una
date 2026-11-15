import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  bookableDays,
  bookableSlots,
  isWithinStudentRescheduleWindow,
  rescheduleAppointment,
  type AvailabilityWindow,
  type BookableSlot,
} from '@dorsu/shared-services';
import type { AppointmentRow } from '@dorsu/shared-types';
import X from 'lucide-react-native/icons/x';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

type Props = {
  /** Appointment being moved (null hides the sheet). */
  appointment: AppointmentRow | null;
  onClose: () => void;
  /** Parent swaps in the server row (new `scheduled_at` / `ends_at`). */
  onRescheduled?: (appointment: AppointmentRow) => void;
};

type SheetProps = {
  appointment: AppointmentRow;
  onClose: () => void;
  onRescheduled?: (appointment: AppointmentRow) => void;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Student reschedule sheet (P12): the same dialog on Home and in Sessions.
 * Availability comes from the assigned counselor's posted windows (any
 * guidance window while the request is still unassigned); the shared
 * `rescheduleAppointment` guard re-validates status, availability and overlap
 * server-side. Confirmed sessions can never reach this sheet — the caller
 * only offers Reschedule for `pending` / `assigned`.
 *
 * The sheet is keyed by appointment id so opening it for a different session
 * starts from a clean selection without resetting state inside an effect.
 */
export function RescheduleModal({ appointment, onClose, onRescheduled }: Props) {
  if (!appointment) return null;
  return (
    <RescheduleSheet
      key={appointment.id}
      appointment={appointment}
      onClose={onClose}
      onRescheduled={onRescheduled}
    />
  );
}

function RescheduleSheet({ appointment, onClose, onRescheduled }: SheetProps) {
  const [windows, setWindows] = useState<AvailabilityWindow[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<BookableSlot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<AppointmentRow | null>(null);

  const canMove =
    appointment.status === 'pending' ||
    appointment.status === 'assigned' ||
    (appointment.status === 'confirmed' &&
      isWithinStudentRescheduleWindow(appointment.scheduled_at));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let query = getSupabase()
          .from('counselor_availability')
          .select('weekday, start_time, end_time, is_recurring, valid_from, valid_to');
        if (appointment.counselor_id) query = query.eq('counselor_id', appointment.counselor_id);
        const { data, error: avErr } = await query.limit(500);
        if (!alive) return;
        if (avErr) throw avErr;
        setWindows((data ?? []) as AvailabilityWindow[]);
      } catch (e) {
        if (!alive) return;
        setWindows([]);
        setError(errorMessage(e, 'Could not load available times.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [appointment.counselor_id]);

  const days = useMemo(() => (windows ? bookableDays(windows, new Date(), 7) : []), [windows]);
  const times = useMemo(
    () => (windows && day ? bookableSlots(windows, day, new Date()) : []),
    [windows, day],
  );
  const dayLabel = day ? days.find((d) => d.date === day) : undefined;

  const pickDay = (date: string) => {
    setDay(date);
    setSlot(null);
    setError('');
  };

  const confirm = async () => {
    if (!slot || busy) return;
    setBusy(true);
    setError('');
    try {
      const updated = (await rescheduleAppointment(
        getSupabase(),
        appointment.id,
        new Date(slot.startIso),
      )) as AppointmentRow;
      setMoved(updated);
      onRescheduled?.(updated);
    } catch (e) {
      setError(errorMessage(e, 'Could not reschedule the session.'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <BottomSheet
      visible
      onClose={close}
      dismissible={!busy}
      accessibilityLabel="Close reschedule"
    >
      {moved ? (
        <View style={styles.body}>
          <View style={styles.headRow}>
            <Text style={styles.eyebrow}>RESCHEDULED</Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close reschedule"
              style={styles.closeBtn}
            >
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.title}>Session moved</Text>
          <View style={styles.whenCard}>
            <View style={styles.whenIcon}>
              <CalendarClock size={20} color={colors.blue} />
            </View>
            <Text style={styles.whenValue}>{formatWhen(moved.scheduled_at)}</Text>
          </View>
          <Text style={styles.help}>
            Your counselor will see the new schedule. You can check it anytime in Sessions.
          </Text>
          <View style={styles.btns}>
            <Button label="Done" onPress={close} style={styles.flex} />
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>MOVE SESSION</Text>
              <Text style={styles.title}>Pick a new time</Text>
            </View>
            <Pressable
              onPress={close}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close reschedule"
              style={styles.closeBtn}
            >
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.whenCard}>
            <View style={styles.whenIcon}>
              <CalendarClock size={20} color={colors.blue} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.whenLabel}>CURRENTLY</Text>
              <Text style={styles.whenValue}>{formatWhen(appointment.scheduled_at)}</Text>
              <Text style={styles.whenMeta}>
                {appointment.counselor_id
                  ? 'Only your counselor’s posted windows are shown.'
                  : 'The guidance head will assign a counselor after you pick a new time.'}
              </Text>
            </View>
          </View>

          {!canMove ? (
            <Text style={styles.error}>
              This session starts within 24 hours — contact the Guidance Office if you need to
              move it.
            </Text>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.section}>Choose a new day</Text>
              {windows === null ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.blue} />
                  <Text style={styles.help}>Loading availability…</Text>
                </View>
              ) : days.length === 0 ? (
                <Text style={styles.help}>
                  No open windows posted right now. Please check back later or contact the
                  Guidance Office.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  {days.map((d) => (
                    <Chip
                      key={d.date}
                      label={`${d.weekdayShort} ${d.dayOfMonth}`}
                      selected={day === d.date}
                      onPress={() => pickDay(d.date)}
                    />
                  ))}
                </ScrollView>
              )}

              <Text style={styles.section}>Available times</Text>
              {day === null ? (
                <Text style={styles.help}>Pick a day to see open times.</Text>
              ) : times.length === 0 ? (
                <Text style={styles.help}>No open times on this day. Try another day.</Text>
              ) : (
                <View style={styles.chipsWrap}>
                  {times.map((t) => (
                    <Chip
                      key={t.startIso}
                      label={t.label}
                      selected={slot?.startIso === t.startIso}
                      selectedTone="yellow"
                      onPress={() => setSlot(t)}
                    />
                  ))}
                </View>
              )}
              <Text style={styles.help}>Sessions last about 60 minutes.</Text>

              {error !== '' ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
          )}

          <View style={styles.btns}>
            <Button
              label="Keep current"
              variant="outline"
              disabled={busy}
              onPress={close}
              style={styles.flex}
            />
            {canMove ? (
              <Button
                label={busy ? 'Moving…' : 'Confirm new time'}
                disabled={busy || slot === null}
                onPress={() => void confirm()}
                style={styles.flex}
              />
            ) : null}
          </View>

          <Text style={styles.hint}>
            {canMove && slot && dayLabel
              ? `New time: ${dayLabel.weekdayShort} ${dayLabel.dayOfMonth} · ${slot.label}`
              : 'Drag down or tap outside to close'}
          </Text>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  flex: { flex: 1 },
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
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.sky,
    borderRadius: radius + 8,
    padding: spacing.md,
  },
  whenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whenLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.blue,
  },
  whenValue: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  whenMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  help: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  section: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: spacing.xs },
  center: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.danger },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
    textAlign: 'center',
  },
});
