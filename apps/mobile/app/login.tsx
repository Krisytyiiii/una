import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Lock from 'lucide-react-native/icons/lock';
import Mail from 'lucide-react-native/icons/mail';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import UserX from 'lucide-react-native/icons/user-x';
import { loginSchema } from '@dorsu/shared-schemas';
import { getSupabase } from '@/lib/supabase/client';
import { ensureStudentRows, friendlyDbError } from '@/lib/supabase/ensureStudent';
import { blockedParams, resolveAccountAccess } from '@/lib/supabase/accountAccess';
import { continueWithGoogle } from '@/lib/supabase/googleAuth';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  cardRadius,
  spacing,
  sizes,
  hitSlop,
  cardShadow,
} from '@/theme';
import { Button } from '@/components/Button';
import { AppDialog, type DialogSpec } from '@/components/AppDialog';
import { ChekieMark } from '@/components/ChekieMark';
import { Field } from '@/components/Field';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { PrimaryCta } from '@/components/PrimaryCta';
import { SunCorner } from '@/components/illustrations/SunCorner';
import { Mascot } from '@/components/mascot/Lumi';
import { useMascot } from '@/components/mascot/useMascot';

const REMEMBER_KEY = '@dorsu-mobile:remember-email';

function friendlyLoginError(message: string): string {
  if (/invalid login credentials|invalid.*credentials/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (/email not confirmed|not confirmed/i.test(message)) {
    return 'Confirm your email first — open the link we sent you, then try again.';
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return message;
}

/** Custom switch: the old checkbox read like a form, this reads like a setting. */
function RememberSwitch({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [slide, value]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });

  return (
    <Pressable
      onPress={() => onChange(!value)}
      hitSlop={hitSlop}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Remember me"
      style={styles.switchRow}
    >
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]} />
      </View>
      <Text style={styles.switchLabel}>Remember me</Text>
    </Pressable>
  );
}

/** Primary CTA lives in components/PrimaryCta so login and signup stay in sync. */

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  // Themed dialogs replace native alerts (see AppDialog).
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const lumi = useMascot('happy');

  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (lumi.reducedMotion) {
      intro.setValue(1);
      return;
    }
    Animated.timing(intro, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro, lumi.reducedMotion]);

  // Session persistence is handled by Supabase; this preference only brings
  // the email back so a returning student does not retype it.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(REMEMBER_KEY)
      .then((saved) => {
        if (!alive || !saved) return;
        setEmail(saved);
        setKeep(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const rememberEmail = async (value: string) => {
    try {
      if (keep) await AsyncStorage.setItem(REMEMBER_KEY, value);
      else await AsyncStorage.removeItem(REMEMBER_KEY);
    } catch {
      // Remembering the email is a convenience; never block sign-in on it.
    }
  };

  const google = async () => {
    setError('');
    setGoogleBusy(true);
    try {
      // Sign-in only: a Google email with no Chekie account is bounced back
      // with a "sign up first" message instead of silently creating an account.
      const res = await continueWithGoogle('signin');
      if (res.status === 'cancelled') return;
      if (res.status === 'blocked') {
        router.replace({ pathname: '/blocked', params: blockedParams(res.role) });
        return;
      }
      if (res.status === 'no-account') {
        setDialog({
          title: 'No account found',
          message: `This Google account${res.email ? ` (${res.email})` : ''} isn't registered yet. Create a student account first — it only takes a minute.`,
          icon: <UserX size={20} color={colors.blue} />,
          note: 'Already registered with your school email and password? Use the form above instead.',
          actions: [
            {
              label: 'Create student account',
              onPress: () => router.push('/register'),
            },
            { label: 'Cancel', variant: 'outline' },
          ],
        });
        return;
      }
      if (res.status === 'error') {
        setError(res.message);
        lumi.react('worried', 1500);
        return;
      }
      // Defensive: the sign-up-only outcome cannot come from sign-in mode.
      if (res.status !== 'success') return;
      if (res.next === 'complete-profile') {
        router.replace({ pathname: '/register', params: { google: '1' } });
        return;
      }
      lumi.react('cheer', 800);
      setTimeout(() => router.replace('/(tabs)/home'), 600);
    } finally {
      setGoogleBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    const parsed = loginSchema.safeParse({ email: email.trim(), password: pw });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      lumi.react('worried', 1500);
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const v = parsed.data;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (signInError) {
        setError(friendlyLoginError(signInError.message));
        lumi.react('worried', 1500);
        return;
      }
      const user = data.user;
      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }
      // Finish any setup left over from signup: with email confirmation ON the
      // `profiles`/`students` inserts could not run until this first login.
      // `ensureStudentRows` is idempotent and reads before writing.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metaString = (key: string) =>
        typeof meta[key] === 'string' ? (meta[key] as string) : undefined;
      const ensured = await ensureStudentRows(supabase, user.id, {
        email: v.email,
        fullName: metaString('full_name') ?? '',
        studentNo: metaString('student_no'),
        program: metaString('program'),
        yearLevel: metaString('year_level'),
      });
      if (!ensured.ok) {
        if (ensured.notStudent) {
          // Staff accounts are refused before any row is written.
          await supabase.auth.signOut().catch(() => undefined);
          router.replace({ pathname: '/blocked', params: blockedParams(ensured.role) });
          return;
        }
        setError(friendlyDbError(ensured.error));
        lumi.react('worried', 1500);
        return;
      }
      await rememberEmail(v.email);
      lumi.react('cheer', 800);
      // Existing student account: go straight into the app. A student whose
      // school record is still empty (legacy signup) finishes the one-time
      // details form first, then lands on Home from /register.
      const access = await resolveAccountAccess(supabase, user.id);
      if (access.status === 'incomplete') {
        setTimeout(
          () => router.replace({ pathname: '/register', params: { complete: '1' } }),
          400,
        );
        return;
      }
      setTimeout(() => router.replace('/(tabs)/home'), 750);
    } catch (e) {
      setError(e instanceof Error ? friendlyLoginError(e.message) : 'Login failed. Please try again.');
      lumi.react('worried', 1500);
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = (value: string) => {
    setEmail(value);
    if (error !== '') setError('');
  };

  const changePassword = (value: string) => {
    setPw(value);
    if (error !== '') setError('');
  };

  const rise = intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <View style={styles.root} {...lumi.gaze}>
      <View style={styles.decorSun} pointerEvents="none">
        <SunCorner size={250} />
      </View>
      <View style={styles.decorBlue} pointerEvents="none" />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.content}>
            <Animated.View
              style={[styles.stack, { opacity: intro, transform: [{ translateY: rise }] }]}
            >
              <View style={styles.brandRow}>
                <ChekieMark size={40} />
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>Chekie</Text>
                  <Text style={styles.brandMeta}>DORSU GUIDANCE</Text>
                </View>
                <Pressable
                  onPress={() => setForgotOpen(true)}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Get sign-in help"
                >
                  <Text style={styles.helpLink}>Need help?</Text>
                </Pressable>
              </View>

              <View style={styles.heroRow}>
                <View style={styles.heroCopy}>
                  <View style={styles.eyebrowRow}>
                    <View style={styles.eyebrowDot} />
                    <Text style={styles.eyebrow}>STUDENT PORTAL</Text>
                  </View>
                  <Text style={styles.title}>Welcome back.</Text>
                  <Text style={styles.helper}>Your sessions and chats are waiting.</Text>
                </View>
                <Mascot controller={lumi} size={78} />
              </View>

              <View style={styles.card}>
                <GoogleButton onPress={() => void google()} busy={googleBusy} disabled={busy} />
                <OrDivider label="OR SIGN IN WITH EMAIL" />

                <Field
                  label="Email"
                  placeholder="you@student.dorsu.edu.ph"
                  value={email}
                  onChangeText={changeEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  icon={<Mail size={sizes.tabIcon} color={colors.muted} />}
                />
                <Field
                  label="Password"
                  placeholder="Enter password"
                  value={pw}
                  onChangeText={changePassword}
                  secureTextEntry={!show}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  icon={<Lock size={sizes.tabIcon} color={colors.muted} />}
                  trailing={
                    <Pressable
                      onPress={() => setShow((s) => !s)}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? (
                        <EyeOff size={sizes.tabIcon} color={colors.blue} />
                      ) : (
                        <Eye size={sizes.tabIcon} color={colors.muted} />
                      )}
                    </Pressable>
                  }
                />

                {error !== '' ? (
                  <View style={styles.errorBanner}>
                    <TriangleAlert size={sizes.tabIcon} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.optionsRow}>
                  <RememberSwitch value={keep} onChange={setKeep} />
                  <Pressable
                    hitSlop={hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel="Forgot password"
                    onPress={() => setForgotOpen(true)}
                  >
                    <Text style={styles.forgot}>Forgot password?</Text>
                  </Pressable>
                </View>

                <PrimaryCta
                  label="Log in"
                  busy={busy}
                  busyLabel="Signing you in…"
                  disabled={busy || googleBusy}
                  onPress={() => void submit()}
                />
              </View>

              <View style={styles.privacy}>
                <ShieldCheck size={sizes.tabIcon} color={colors.blue} />
                <Text style={styles.privacyText}>
                  Private by design. Your name stays hidden under RA 10173 unless safety requires
                  it.
                </Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>New to Chekie?</Text>
                <Pressable
                  onPress={() => router.push('/register')}
                  hitSlop={hitSlop}
                  accessibilityRole="link"
                  accessibilityLabel="Create a student account"
                >
                  <Text style={styles.footerLink}>Create a student account</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={forgotOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetScrim} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setForgotOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close help"
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetIcon}>
              <Lock size={sizes.tabIcon + 4} color={colors.blue} />
            </View>
            <Text style={styles.sheetTitle}>Reset your password</Text>
            <Text style={styles.sheetBody}>
              For your protection, password resets are handled by the Guidance Office. Visit us at
              the Main Campus with your student ID and we&apos;ll help you back into your account.
            </Text>
            <Button label="Got it" onPress={() => setForgotOpen(false)} />
          </View>
        </View>
      </Modal>

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stack: { gap: spacing.sm },

  decorSun: { position: 'absolute', top: -90, right: -80, opacity: 0.38 },
  decorBlue: {
    position: 'absolute',
    bottom: -130,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.sky,
    opacity: 0.65,
  },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandCopy: { flex: 1, gap: 1 },
  brandName: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  brandMeta: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
    letterSpacing: 1.4,
  },
  helpLink: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCopy: { flex: 1, gap: spacing.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
    letterSpacing: 1.6,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  helper: { fontFamily: fontFamily.regular, fontSize: fontSize.md, lineHeight: 19, color: colors.muted },

  card: {
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...cardShadow,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 16, color: colors.danger },

  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: colors.blue },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink },
  forgot: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },

  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: cardRadius,
    padding: spacing.sm + 2,
  },
  privacyText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 18, color: colors.ink },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  footerText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  footerLink: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheetScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink,
    opacity: 0.35,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  sheetBody: { fontFamily: fontFamily.regular, fontSize: fontSize.md, lineHeight: 19, color: colors.muted },
});
