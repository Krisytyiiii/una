import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Bell from 'lucide-react-native/icons/bell';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import IdCard from 'lucide-react-native/icons/id-card';
import Info from 'lucide-react-native/icons/info';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import Megaphone from 'lucide-react-native/icons/megaphone';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Phone from 'lucide-react-native/icons/phone';
import School from 'lucide-react-native/icons/school';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import {
  removeAvatar,
  setAvatarSharing,
  signAvatarUrl,
  uploadAvatar,
} from '@dorsu/shared-services';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { useNotificationCount } from '@/lib/notifications-context';
import {
  colors,
  cardRadius,
  cardShadow,
  floatingShadow,
  fontFamily,
  fontSize,
  hitSlop,
  radius,
  spacing,
  sizes,
} from '@/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AppDialog, type DialogSpec } from '@/components/AppDialog';
import { InitialsAvatar } from '@/components/InitialsAvatar';
import { PressableScale } from '@/components/PressableScale';
import { TAB_BAR_BASE } from '@/components/TabBar';

type Me = {
  id: string;
  role: string;
  fullName: string;
  alias: string;
  avatarPath: string | null;
  avatarUri: string | null;
  share: boolean;
  email: string;
  studentNo: string;
  program: string;
  yearLevel: string;
  college: string;
  contactNo: string;
  createdAt: string | null;
};

type Stats = {
  upcoming: number;
  completed: number;
  checkins: number;
};

const ACTIVE = ['pending', 'assigned', 'confirmed'];
const EMPTY_STATS: Stats = { upcoming: 0, completed: 0, checkins: 0 };

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  counselor: 'Counselor',
  guidance_head: 'Guidance Head',
  admin: 'Admin',
  guidance_personnel: 'Guidance Personnel',
  faculty: 'Faculty',
};

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** "November 2026" for the "member since" line. */
function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

function Stat({
  value,
  label,
  onPress,
  accessibilityLabel,
}: {
  value: number;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.stat}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PressableScale>
  );
}

function ActionTile({
  icon,
  label,
  sub,
  tint,
  iconColor,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  tint: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      style={styles.action}
    >
      <View style={[styles.actionIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.actionSub} numberOfLines={1}>
        {sub}
      </Text>
      <View style={[styles.actionArrow, { backgroundColor: tint }]}>
        <ChevronRight size={12} color={iconColor} />
      </View>
    </PressableScale>
  );
}

function InfoRow({
  icon,
  label,
  value,
  muted = false,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, muted && styles.infoValueMuted]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  badge,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.menuRowBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {badge && badge > 0 ? (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={sizes.tabIcon} color={colors.muted} />
    </Pressable>
  );
}

/** Pulsing placeholders so the first paint matches the real layout. */
function ProfileSkeleton() {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: pulse, gap: spacing.md }}
    >
      <View style={styles.skelHero}>
        <View style={styles.skelAvatar} />
        <View style={styles.skelHeroLines}>
          <View style={styles.skelLineWide} />
          <View style={styles.skelLineMid} />
        </View>
      </View>
      <View style={styles.skelActions}>
        {[0, 1, 2].map((i) => (
          <View key={`action-${i}`} style={styles.skelAction} />
        ))}
      </View>
      <View style={styles.skelCard}>
        {[0, 1, 2].map((i) => (
          <View key={`row-${i}`} style={styles.skelRow}>
            <View style={styles.skelDot} />
            <View style={styles.skelRowLines}>
              <View style={styles.skelLineMid} />
              <View style={styles.skelLineShort} />
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

export default function Profile() {
  const { unread } = useNotificationCount();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'share' | null>(null);
  const [error, setError] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);
  // Custom themed dialogs replace the native Alert everywhere (see AppDialog).
  const [dialog, setDialog] = useState<DialogSpec | null>(null);

  const showNotice = (title: string, message: string, kind: 'info' | 'error' = 'error') => {
    setDialog({
      title,
      message,
      tone: kind === 'error' ? 'danger' : 'default',
      icon:
        kind === 'error' ? (
          <CircleAlert size={20} color={colors.danger} />
        ) : (
          <Info size={20} color={colors.blue} />
        ),
      actions: [{ label: 'Got it' }],
    });
  };

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMe(null);
        setStats(EMPTY_STATS);
        setError('');
        return;
      }

      const [profileRes, studentRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'role, full_name, email, avatar_url, share_avatar_with_counselor, created_at',
          )
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('students')
          .select(
            'id, student_no, program, year_level, college, contact_no, anonymous_alias',
          )
          .eq('profile_id', user.id)
          .maybeSingle(),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (studentRes.error) throw studentRes.error;

      const p = profileRes.data as {
        role: string | null;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
        share_avatar_with_counselor: boolean | null;
        created_at: string | null;
      } | null;
      const s = studentRes.data as {
        id: string;
        student_no: string | null;
        program: string | null;
        year_level: string | null;
        college: string | null;
        contact_no: string | null;
        anonymous_alias: string | null;
      } | null;

      // Stats are best-effort: a profile must still render if these reads fail.
      let nextStats = EMPTY_STATS;
      if (s?.id) {
        try {
          const [apptRes, pssRes] = await Promise.all([
            supabase
              .from('appointments')
              .select('status, scheduled_at')
              .eq('student_id', s.id),
            supabase
              .from('pss10_assessments')
              .select('id', { count: 'exact', head: true })
              .eq('student_id', s.id),
          ]);
          const now = new Date().getTime();
          const rows = (apptRes.data ?? []) as {
            status: string;
            scheduled_at: string;
          }[];
          nextStats = {
            upcoming: rows.filter(
              (r) =>
                ACTIVE.includes(r.status) &&
                new Date(r.scheduled_at).getTime() >= now,
            ).length,
            completed: rows.filter((r) => r.status === 'completed').length,
            checkins: pssRes.count ?? 0,
          };
        } catch {
          nextStats = EMPTY_STATS;
        }
      }

      const avatarUri = await signAvatarUrl(supabase, p?.avatar_url ?? null);

      setMe({
        id: user.id,
        role: p?.role ?? 'student',
        fullName: p?.full_name ?? '',
        alias: s?.anonymous_alias ?? '',
        avatarPath: p?.avatar_url ?? null,
        avatarUri,
        share: p?.share_avatar_with_counselor ?? false,
        email: p?.email ?? user.email ?? '',
        studentNo: s?.student_no ?? '',
        program: s?.program ?? '',
        yearLevel: s?.year_level ?? '',
        college: s?.college ?? '',
        contactNo: s?.contact_no ?? '',
        createdAt: p?.created_at ?? null,
      });
      setStats(nextStats);
      setError('');
      setPhotoFailed(false);
    } catch (e) {
      setError(errorMessage(e, 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A freshly signed URL is a new value; give a failed image one more chance.
  // (Reset in the load/upload handlers instead of an effect to avoid an extra
  // render pass on every focus.)

  const changePhoto = async () => {
    if (!me || busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showNotice('Photo access needed', 'Allow photo access to choose a profile picture.', 'info');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    if (!asset.base64) {
      showNotice("Couldn't read that photo", 'Please choose a different image.');
      return;
    }
    const contentType =
      asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(asset.base64);
    } catch {
      showNotice("Couldn't read that photo", 'Please choose a different image.');
      return;
    }
    if (bytes.length > 5 * 1024 * 1024) {
      showNotice('Photo too large', 'Choose an image under 5 MB.');
      return;
    }
    setBusy('photo');
    try {
      const supabase = getSupabase();
      const path = await uploadAvatar(supabase, {
        profileId: me.id,
        previousPath: me.avatarPath,
        bytes,
        contentType,
      });
      const uri = await signAvatarUrl(supabase, path);
      setPhotoFailed(false);
      setMe((prev) => (prev ? { ...prev, avatarPath: path, avatarUri: uri } : prev));
    } catch (e) {
      showNotice("Couldn't upload photo", errorMessage(e, 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    if (!me?.avatarPath || busy) return;
    setBusy('photo');
    try {
      await removeAvatar(getSupabase(), me.id, me.avatarPath);
      setPhotoFailed(false);
      setMe((prev) => (prev ? { ...prev, avatarPath: null, avatarUri: null } : prev));
    } catch {
      showNotice("Couldn't remove photo", 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmRemovePhoto = () => {
    if (!me?.avatarPath || busy) return;
    setDialog({
      title: 'Remove profile photo?',
      message: 'Your monogram will show instead.',
      tone: 'danger',
      icon: <Camera size={20} color={colors.danger} />,
      actions: [
        { label: 'Remove photo', variant: 'danger', onPress: () => void removePhoto() },
        { label: 'Cancel', variant: 'outline' },
      ],
    });
  };

  /** One tap on the avatar offers change/remove instead of two text links. */
  const openPhotoOptions = () => {
    if (!me || busy) return;
    if (!me.avatarPath) {
      void changePhoto();
      return;
    }
    setDialog({
      title: 'Profile photo',
      message: 'Choose how your photo shows up for your counselor.',
      icon: <Camera size={20} color={colors.blue} />,
      actions: [
        {
          label: 'Choose a new photo',
          // iOS dismisses the modal over ~200ms; opening the picker sooner can
          // fail with "presentation in progress".
          onPress: () => {
            setTimeout(() => void changePhoto(), 240);
          },
        },
        { label: 'Remove photo', variant: 'danger', onPress: confirmRemovePhoto },
        { label: 'Cancel', variant: 'outline' },
      ],
    });
  };

  const toggleShare = async (value: boolean) => {
    if (!me || busy) return;
    setMe((prev) => (prev ? { ...prev, share: value } : prev));
    setBusy('share');
    try {
      await setAvatarSharing(getSupabase(), me.id, value);
    } catch {
      setMe((prev) => (prev ? { ...prev, share: !value } : prev));
      showNotice("Couldn't save that setting", 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    await getSupabase().auth.signOut().catch(() => undefined);
    router.replace('/login');
  };

  const confirmLogout = () => {
    setDialog({
      title: 'Log out?',
      message: 'You can sign back in anytime.',
      tone: 'danger',
      icon: <LogOut size={20} color={colors.danger} />,
      actions: [
        { label: 'Log out', variant: 'danger', onPress: () => void logout() },
        { label: 'Cancel', variant: 'outline' },
      ],
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  };

  const isStudent = !me || me.role === 'student';
  const roleLabel = me ? (ROLE_LABEL[me.role] ?? me.role.replace(/_/g, ' ')) : 'Student';
  const showPhoto = me?.avatarUri !== null && me?.avatarUri !== undefined && !photoFailed;

  const details = me
    ? [
        {
          label: 'Email',
          value: me.email || 'Not set',
          muted: !me.email,
          icon: <Mail size={15} color={colors.blue} />,
        },
        ...(isStudent
          ? [
              {
                label: 'Student number',
                value: me.studentNo || 'Not set',
                muted: !me.studentNo,
                icon: <IdCard size={15} color={colors.blue} />,
              },
              {
                label: 'Program',
                value: me.program || 'Not set',
                muted: !me.program,
                icon: <GraduationCap size={15} color={colors.blue} />,
              },
              {
                label: 'Year level',
                value: me.yearLevel || 'Not set',
                muted: !me.yearLevel,
                icon: <CalendarDays size={15} color={colors.blue} />,
              },
              {
                label: 'College',
                value: me.college || 'Not set',
                muted: !me.college,
                icon: <School size={15} color={colors.blue} />,
              },
              {
                label: 'Contact number',
                value: me.contactNo || 'Not set',
                muted: !me.contactNo,
                icon: <Phone size={15} color={colors.blue} />,
              },
            ]
          : []),
      ]
    : [];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.blue}
              colors={[colors.blue]}
            />
          }
        >
          <View style={styles.head}>
            <View style={styles.headRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>YOUR SPACE</Text>
                <Text style={styles.title}>Profile</Text>
              </View>
              <PressableScale
                onPress={() => router.push('/notifications')}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={
                  unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
                }
                style={styles.bellBtn}
              >
                <Bell size={18} color={colors.ink} />
                {unread > 0 ? <View style={styles.bellDot} /> : null}
              </PressableScale>
            </View>
            <Text style={styles.sub}>Private by design — you choose what counselors see.</Text>
          </View>

          {loading ? (
            <ProfileSkeleton />
          ) : (
            <>
              {error !== '' ? (
                <Card style={styles.errCard}>
                  <Text style={styles.errText}>{error}</Text>
                  <Button label="Try again" variant="outline" onPress={() => void load()} />
                </Card>
              ) : null}

              {me ? (
                <>
                  <View style={styles.hero}>
                    <View pointerEvents="none" style={styles.heroSun} />
                    <View pointerEvents="none" style={styles.heroRing} />

                    <View style={styles.heroTop}>
                      <View style={styles.rolePill}>
                        <View style={styles.roleDot} />
                        <Text style={styles.roleText}>{roleLabel}</Text>
                      </View>
                      {me.createdAt ? (
                        <Text style={styles.memberSince}>
                          Since {monthYear(me.createdAt)}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.identity}>
                      <PressableScale
                        onPress={openPhotoOptions}
                        scaleTo={0.94}
                        disabled={busy === 'photo'}
                        accessibilityRole="button"
                        accessibilityLabel="Change profile photo"
                        accessibilityHint="Opens photo options"
                        style={styles.avatarWrap}
                      >
                        <View style={styles.avatarRing}>
                          {showPhoto && me.avatarUri ? (
                            <Image
                              source={{ uri: me.avatarUri }}
                              style={styles.avatarImg}
                              resizeMode="cover"
                              onError={() => setPhotoFailed(true)}
                            />
                          ) : (
                            <InitialsAvatar
                              name={me.fullName || me.alias || 'Student'}
                              size={72}
                              tone={colors.blueDark}
                            />
                          )}
                        </View>
                        <View style={styles.cameraBadge}>
                          <Camera size={12} color={colors.ink} />
                        </View>
                        {busy === 'photo' ? (
                          <View style={styles.photoBusy}>
                            <ActivityIndicator color={colors.white} size="small" />
                          </View>
                        ) : null}
                      </PressableScale>

                      <View style={styles.identityText}>
                        <Text style={styles.name} numberOfLines={1}>
                          {me.fullName || 'Student'}
                        </Text>
                        {me.alias ? (
                          <View style={styles.aliasChip}>
                            <EyeOff size={10} color={colors.sun} />
                            <Text style={styles.aliasText} numberOfLines={1}>
                              {me.alias}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.identityMeta} numberOfLines={2}>
                          {[me.studentNo, me.program].filter(Boolean).join(' · ') ||
                            'DOrSU student'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.stats}>
                      <Stat
                        value={stats.upcoming}
                        label="Upcoming"
                        accessibilityLabel={`${stats.upcoming} upcoming sessions`}
                        onPress={() => router.push('/(tabs)/sessions')}
                      />
                      <View style={styles.statDivider} />
                      <Stat
                        value={stats.completed}
                        label="Completed"
                        accessibilityLabel={`${stats.completed} completed sessions`}
                        onPress={() => router.push('/(tabs)/sessions')}
                      />
                      <View style={styles.statDivider} />
                      <Stat
                        value={stats.checkins}
                        label="Check-ins"
                        accessibilityLabel={`${stats.checkins} check-ins`}
                        onPress={() => router.push('/check-in')}
                      />
                    </View>
                  </View>

                  <SectionTitle>Quick actions</SectionTitle>
                  <View style={styles.actions}>
                    <ActionTile
                      icon={<CalendarDays size={17} color={colors.ink} />}
                      label="Book"
                      sub="New session"
                      tint={colors.sunSoft}
                      iconColor={colors.ink}
                      onPress={() => router.push('/book')}
                    />
                    <ActionTile
                      icon={<ClipboardList size={17} color={colors.blue} />}
                      label="Check in"
                      sub="Stress check"
                      tint={colors.sky}
                      iconColor={colors.blue}
                      onPress={() => router.push('/check-in')}
                    />
                    <ActionTile
                      icon={<MessageCircle size={17} color={colors.blue} />}
                      label="Messages"
                      sub="Guidance office"
                      tint={colors.chip}
                      iconColor={colors.blue}
                      onPress={() => router.push('/chat')}
                    />
                  </View>

                  <SectionTitle>About you</SectionTitle>
                  <Card style={styles.infoCard}>
                    {details.map((row, index) => (
                      <InfoRow
                        key={row.label}
                        icon={row.icon}
                        label={row.label}
                        value={row.value}
                        muted={row.muted}
                        last={index === details.length - 1}
                      />
                    ))}
                    <Text style={styles.infoNote}>
                      Details come from your DOrSU record. Contact the Guidance Office if
                      something needs updating.
                    </Text>
                  </Card>

                  {isStudent ? (
                    <>
                      <SectionTitle>Privacy</SectionTitle>
                      <Card style={styles.privacyCard}>
                        <View style={styles.privacyTop}>
                          <View style={[styles.privacyIcon, styles.privacyIconOk]}>
                            <ShieldCheck size={17} color={colors.success} />
                          </View>
                          <View style={styles.flex}>
                            <Text style={styles.rowTitle}>Share photo with my counselor</Text>
                            <Text style={styles.rowSub}>
                              Off by default. Only a counselor with a session, referral, or
                              chat with you can see it.
                            </Text>
                          </View>
                          <Switch
                            value={me.share}
                            onValueChange={(value) => void toggleShare(value)}
                            disabled={busy !== null}
                            accessibilityLabel="Share photo with my counselor"
                            trackColor={{ false: colors.border, true: colors.blue }}
                            thumbColor={colors.white}
                          />
                        </View>

                        <View style={styles.statusLine}>
                          <View
                            style={[
                              styles.statusDot,
                              me.share ? styles.statusDotOn : styles.statusDotOff,
                            ]}
                          />
                          <Text style={styles.statusText}>
                            {me.share
                              ? 'Photo sharing is on · change it anytime'
                              : 'Photo sharing is off · only your alias is used'}
                          </Text>
                        </View>

                        <View style={styles.privacyDivider} />

                        <View style={styles.aliasRow}>
                          <View style={[styles.privacyIcon, styles.privacyIconAlias]}>
                            <EyeOff size={16} color={colors.blue} />
                          </View>
                          <View style={styles.flex}>
                            <Text style={styles.aliasLabel}>Anonymous alias</Text>
                            <Text style={styles.aliasValue}>{me.alias || 'Not set'}</Text>
                            <Text style={styles.rowSub}>
                              The name used when your identity is kept anonymous.
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </>
                  ) : null}

                  <SectionTitle>More</SectionTitle>
                  <Card style={styles.menu}>
                    <MenuRow
                      icon={<Bell size={16} color={colors.blue} />}
                      label="Notifications"
                      sub="Updates about your care"
                      badge={unread}
                      onPress={() => router.push('/notifications')}
                    />
                    <MenuRow
                      icon={<Megaphone size={16} color={colors.blue} />}
                      label="Announcements"
                      sub="Guidance Office news"
                      onPress={() => router.push('/announcements')}
                    />
                    <MenuRow
                      icon={<Eye size={16} color={colors.blue} />}
                      label="See onboarding screens"
                      sub="View the welcome screens again"
                      last
                      onPress={() => router.push({ pathname: '/', params: { replay: '1' } })}
                    />
                  </Card>

                  <PressableScale
                    onPress={confirmLogout}
                    scaleTo={0.97}
                    accessibilityRole="button"
                    accessibilityLabel="Log out"
                    style={styles.logout}
                  >
                    <View style={styles.logoutIcon}>
                      <LogOut size={16} color={colors.danger} />
                    </View>
                    <Text style={styles.logoutText}>Log out</Text>
                    <ChevronRight size={sizes.tabIcon} color={colors.danger} />
                  </PressableScale>

                  <Text style={styles.footnote}>
                    DOrSU Guidance Office · Chekie{'\n'}Your information is stored securely.
                  </Text>
                </>
              ) : error === '' ? (
                <Card style={styles.signedOut}>
                  <Text style={styles.signedOutTitle}>You’re signed out</Text>
                  <Text style={styles.rowSub}>Log in to see your profile and sessions.</Text>
                  <View style={styles.signedOutAction}>
                    <Button label="Log in" onPress={() => router.replace('/login')} />
                  </View>
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: TAB_BAR_BASE + spacing.xl,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },

  /* -------------------------------- header ------------------------------- */

  head: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 1.1,
    color: colors.muted,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  sub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.chip,
  },

  /* --------------------------------- hero -------------------------------- */

  hero: {
    backgroundColor: colors.blue,
    borderRadius: cardRadius + 8,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    ...floatingShadow,
    shadowOpacity: 0.18,
  },
  heroSun: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.sun,
    opacity: 0.22,
  },
  heroRing: {
    position: 'absolute',
    bottom: -60,
    left: -34,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 18,
    borderColor: colors.blueDark,
    opacity: 0.6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.blueDark,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun },
  roleText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.7,
    color: colors.white,
    textTransform: 'uppercase',
  },
  memberSince: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    color: colors.sky,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: { width: 78, height: 78 },
  avatarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    padding: 3,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  cameraBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.blue,
  },
  photoBusy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 39,
    backgroundColor: 'rgba(16,34,64,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 3 },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    color: colors.white,
  },
  aliasChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: colors.blueDark,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  aliasText: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.sun,
  },
  identityMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.sky,
  },

  /* -------------------------------- stats -------------------------------- */

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blueDark,
    borderRadius: radius + 8,
    paddingVertical: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 0 },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    color: colors.white,
  },
  statLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    color: colors.sky,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: colors.blue,
    opacity: 0.7,
  },

  /* ------------------------------- sections ------------------------------ */

  section: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginTop: spacing.xs,
  },

  /* ------------------------------ actions -------------------------------- */

  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
    ...cardShadow,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  actionSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  actionArrow: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* -------------------------------- about -------------------------------- */

  infoCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.creamLine,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.5,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  infoValueMuted: { color: colors.muted },
  infoNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    lineHeight: fontSize.xxs + 4,
    color: colors.muted,
    paddingTop: spacing.sm,
  },

  /* ------------------------------- privacy ------------------------------- */

  privacyCard: { gap: spacing.sm },
  privacyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  privacyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIconOk: { backgroundColor: colors.successSoft },
  privacyIconAlias: { backgroundColor: colors.sky },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  rowSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 4,
    color: colors.muted,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.disabledBg,
    borderRadius: radius + 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotOn: { backgroundColor: colors.success },
  statusDotOff: { backgroundColor: colors.disabledText },
  statusText: {
    flexShrink: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  privacyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.creamLine,
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  aliasLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.5,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  aliasValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },

  /* -------------------------------- menu --------------------------------- */

  menu: { padding: 0 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.creamLine,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  menuSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  menuBadge: {
    minWidth: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.white,
  },

  /* ------------------------------- logout -------------------------------- */

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  logoutIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  footnote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    lineHeight: fontSize.xxs + 4,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  /* ------------------------------- errors -------------------------------- */

  errCard: {
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  errText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  signedOut: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  signedOutTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  signedOutAction: { marginTop: spacing.sm },

  /* ------------------------------ skeleton ------------------------------- */

  skelHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.chip,
    borderRadius: cardRadius + 8,
    padding: spacing.lg,
  },
  skelAvatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.border,
  },
  skelHeroLines: { flex: 1, gap: spacing.sm },
  skelLineWide: {
    height: 16,
    width: '78%',
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  skelLineMid: {
    height: 10,
    width: '58%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  skelLineShort: {
    height: 8,
    width: '38%',
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  skelActions: { flexDirection: 'row', gap: spacing.sm },
  skelAction: {
    flex: 1,
    height: 108,
    borderRadius: cardRadius,
    backgroundColor: colors.chip,
  },
  skelCard: {
    backgroundColor: colors.chip,
    borderRadius: cardRadius,
    padding: spacing.md,
    gap: spacing.md,
  },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skelDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  skelRowLines: { flex: 1, gap: spacing.xs },
});
