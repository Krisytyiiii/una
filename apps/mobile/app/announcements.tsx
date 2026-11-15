import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Megaphone from 'lucide-react-native/icons/megaphone';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import type { AnnouncementRow } from '@dorsu/shared-types';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  cardRadius,
  spacing,
  hitSlop,
  cardShadow,
  floatingShadow,
} from '@/theme';
import { PressableScale } from '@/components/PressableScale';
import { Button } from '@/components/Button';

type Announcement = Pick<
  AnnouncementRow,
  'id' | 'title' | 'body' | 'audience' | 'image_url' | 'event_date' | 'published_at'
>;

type Filter = 'All' | 'Events' | 'Notices';

const FILTERS: Filter[] = ['All', 'Events', 'Notices'];

/** A published announcement counts as new for the first five days. */
const NEW_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

function badgeFor(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function eventLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function postedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Announcement photo from the public `announcement-images` bucket (00025).
 * A broken/expired URL removes the frame instead of leaving a grey box.
 */
function AnnouncementPhoto({ uri, expanded }: { uri: string; expanded: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      style={[styles.photo, expanded ? styles.photoExpanded : styles.photoCollapsed]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityRole="image"
      accessibilityLabel="Announcement photo"
    />
  );
}

/**
 * Standalone announcement feed. The home dashboard only links here so the
 * cards stay readable, and the segmented tabs separate dated events from
 * general notices (an announcement is an "event" when `event_date` is set).
 */
export default function Announcements() {
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Captured when the feed loads rather than read during render, so the NEW
  // badge stays stable across re-renders (react-hooks/purity).
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setError('');
      const { data, error: loadError } = await getSupabase()
        .from('announcements')
        .select('id, title, body, audience, image_url, event_date, published_at')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(50);
      if (loadError) throw loadError;
      setRows((data ?? []) as Announcement[]);
      setLoadedAt(Date.now());
    } catch (e) {
      setError(errorMessage(e, 'Could not load announcements.'));
      setRows((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const list = rows ?? [];
    const events = list.filter((row) => row.event_date !== null).length;
    return { All: list.length, Events: events, Notices: list.length - events };
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    if (filter === 'Events') {
      return list
        .filter((row) => row.event_date !== null)
        .sort(
          (a, b) =>
            new Date(a.event_date ?? 0).getTime() - new Date(b.event_date ?? 0).getTime(),
        );
    }
    if (filter === 'Notices') return list.filter((row) => row.event_date === null);
    return list;
  }, [rows, filter]);

  const onRefresh = () => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  };

  const emptyCopy =
    filter === 'Events'
      ? {
          title: 'No events scheduled',
          body: 'Guidance Office events with a date will show up here.',
        }
      : filter === 'Notices'
        ? {
            title: 'No notices yet',
            body: 'General updates from the Guidance Office will show up here.',
          }
        : {
            title: 'No announcements yet',
            body: 'New updates from the Guidance Office will show up here.',
          };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.blobSun} />
      <View pointerEvents="none" style={styles.blobSky} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <ChevronLeft size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>GUIDANCE OFFICE</Text>
            <Text style={styles.title}>Announcements</Text>
          </View>
          <View style={styles.totalPill}>
            <Text style={styles.totalText}>{rows === null ? '—' : rows.length}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          {FILTERS.map((name) => {
            const selected = filter === name;
            return (
              <Pressable
                key={name}
                onPress={() => setFilter(name)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${name}, ${counts[name]} announcements`}
                style={[styles.filter, selected && styles.filterActive]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                  {name}
                </Text>
                <Text style={[styles.filterCount, selected && styles.filterCountActive]}>
                  {rows === null ? '—' : counts[name]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
          }
        >
          {error !== '' ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Button label="Try again" variant="outline" onPress={() => void load()} />
            </View>
          ) : null}

          {rows === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.blue} />
              <Text style={styles.mutedText}>Loading announcements…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Megaphone size={24} color={colors.blue} />
              </View>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
            </View>
          ) : (
            filtered.map((item) => {
              const anchor = item.event_date ?? item.published_at;
              const badge = anchor ? badgeFor(anchor) : { month: '', day: '' };
              const isEvent = item.event_date !== null;
              const isNew =
                item.published_at !== null &&
                loadedAt - new Date(item.published_at).getTime() < NEW_WINDOW_MS;
              const expanded = expandedId === item.id;

              return (
                <PressableScale
                  key={item.id}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                  scaleTo={0.99}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${item.title}. ${expanded ? 'Collapse' : 'Read more'}`}
                  style={[styles.card, isNew && styles.cardNew]}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.date, isEvent && styles.dateEvent]}>
                      <Text style={styles.dateMonth}>{badge.month}</Text>
                      <Text style={styles.dateDay}>{badge.day}</Text>
                    </View>
                    <View style={styles.cardHeadText}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {isNew ? (
                          <View style={styles.newPill}>
                            <Text style={styles.newText}>NEW</Text>
                          </View>
                        ) : null}
                      </View>
                      {isEvent && item.event_date ? (
                        <View style={styles.metaRow}>
                          <CalendarDays size={12} color={colors.blue} />
                          <Text style={styles.cardMeta}>Event · {eventLabel(item.event_date)}</Text>
                        </View>
                      ) : item.published_at ? (
                        <Text style={styles.cardMeta}>Posted {postedLabel(item.published_at)}</Text>
                      ) : null}
                    </View>
                    <ChevronDown
                      size={16}
                      color={colors.muted}
                      style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                    />
                  </View>
                  <Text style={styles.cardBody} numberOfLines={expanded ? undefined : 3}>
                    {item.body}
                  </Text>
                  {item.image_url ? (
                    <AnnouncementPhoto uri={item.image_url} expanded={expanded} />
                  ) : null}
                  <Text style={styles.readMore}>{expanded ? 'Show less' : 'Read more'}</Text>
                </PressableScale>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white, overflow: 'hidden' },
  safe: { flex: 1 },
  blobSun: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.sunSoft,
    opacity: 0.6,
  },
  blobSky: {
    position: 'absolute',
    top: 220,
    left: -130,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.sky,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  headerText: { flex: 1, gap: 1 },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.9,
    color: colors.muted,
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  totalPill: {
    minWidth: 36,
    height: 28,
    borderRadius: radius + 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    padding: spacing.xs,
    borderRadius: radius + 14,
    backgroundColor: colors.chip,
  },
  filter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 36,
    borderRadius: radius + 10,
  },
  filterActive: {
    backgroundColor: colors.white,
    ...cardShadow,
  },
  filterText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.muted },
  filterTextActive: { fontFamily: fontFamily.bold, color: colors.ink },
  filterCount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
    minWidth: 16,
    textAlign: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  filterCountActive: { backgroundColor: colors.sunSoft, color: colors.ink },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  errorCard: {
    backgroundColor: colors.white,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.danger },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  mutedText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: cardRadius + 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    ...cardShadow,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: cardRadius + 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  cardNew: {
    borderColor: colors.creamLine,
    borderWidth: 1,
    ...floatingShadow,
    shadowOpacity: 0.1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  date: {
    width: 50,
    borderRadius: radius + 4,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.chip,
  },
  dateEvent: { backgroundColor: colors.sun },
  dateMonth: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
    letterSpacing: 0.6,
  },
  dateDay: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  cardHeadText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  cardTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  newPill: {
    backgroundColor: colors.sunSoft,
    borderRadius: radius + 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  newText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.6,
    color: colors.ink,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.muted },
  cardBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink },
  photo: {
    width: '100%',
    borderRadius: radius + 6,
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  /** Collapsed cards get a short preview; expanding shows more of the photo. */
  photoCollapsed: { height: 150 },
  photoExpanded: { aspectRatio: 4 / 3 },
  readMore: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.blue },
});
