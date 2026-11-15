import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import BookOpen from 'lucide-react-native/icons/book-open';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import IdCard from 'lucide-react-native/icons/id-card';
import Lock from 'lucide-react-native/icons/lock';
import LogIn from 'lucide-react-native/icons/log-in';
import Mail from 'lucide-react-native/icons/mail';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import Search from 'lucide-react-native/icons/search';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { registerStudentSchema } from '@dorsu/shared-schemas';
import { getSupabase } from '@/lib/supabase/client';
import { ensureStudentRows, friendlyDbError } from '@/lib/supabase/ensureStudent';
import { blockedParams, resolveAccountAccess } from '@/lib/supabase/accountAccess';
import { continueWithGoogle } from '@/lib/supabase/googleAuth';
import { saveStudentDetails } from '@/lib/supabase/studentSetup';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  buttonRadius,
  cardRadius,
  spacing,
  sizes,
  hitSlop,
  cardShadow,
} from '@/theme';
import { ChekieMark } from '@/components/ChekieMark';
import { AppDialog, type DialogSpec } from '@/components/AppDialog';
import { Chip } from '@/components/Chip';
import { Field } from '@/components/Field';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { PrimaryCta } from '@/components/PrimaryCta';
import { Mascot } from '@/components/mascot/Lumi';
import { useMascot } from '@/components/mascot/useMascot';
import { DORSU_PROGRAM_GROUPS, YEAR_LEVELS, type ProgramGroup } from '@/data/academics';

function friendlySignupError(message: string): string {
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (/already|exists|registered|duplicate/i.test(message)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  return message;
}

/**
 * Birthdate entry without a native date picker: digits only, auto-formatted as
 * YYYY-MM-DD (00079). Optional — blank means "not provided".
 */
function formatBirthdateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * Student numbers are 20YY-XXXX. Digits only, with the dash inserted for the
 * student so the field can never submit a malformed value.
 */
function formatStudentNoInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

const GENDER_OPTIONS: { value: 'male' | 'female' | 'prefer_not_to_say'; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const STEP_COUNT = 2;

function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
  };
}

function isStrongPassword(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.lower && c.upper && c.digit;
}

function ReqRow({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={styles.reqRow}>
      {met ? (
        <Check size={sizes.tabIcon} color={colors.blue} />
      ) : (
        <X size={sizes.tabIcon} color={colors.border} />
      )}
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{text}</Text>
    </View>
  );
}

export default function Register() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  // 00080: the guidance head manages these lists on Web. Start from the
  // bundled DOrSU catalog, then swap in the live list when it loads.
  const [programGroups, setProgramGroups] = useState<readonly ProgramGroup[]>(DORSU_PROGRAM_GROUPS);
  const [yearLevels, setYearLevels] = useState<readonly string[]>(YEAR_LEVELS);
  // Optional demographics (00079) — power the referral form's autofill.
  const [gender, setGender] = useState<'' | 'male' | 'female' | 'prefer_not_to_say'>('');
  const [birthdate, setBirthdate] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [programQuery, setProgramQuery] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  // Hosted Supabase has email confirmation ON, so signUp() returns no session
  // and the `profiles` insert cannot run yet (RLS needs `authenticated`).
  // Hold the email here and finish setup at first login instead.
  const [awaitingEmail, setAwaitingEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otp, setOtp] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState('');
  // Themed dialogs replace native alerts (see AppDialog).
  const [dialog, setDialog] = useState<DialogSpec | null>(null);

  const lumi = useMascot('happy');
  const intro = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const mailPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lumi.reducedMotion) {
      intro.setValue(1);
      return;
    }
    intro.setValue(0);
    Animated.timing(intro, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro, lumi.reducedMotion, step]);

  // Soft radar pulse behind the mail badge on the "check your email" screen.
  useEffect(() => {
    if (awaitingEmail === null || lumi.reducedMotion) {
      mailPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(mailPulse, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [awaitingEmail, lumi.reducedMotion, mailPulse]);

  // Resend cooldown ticker.
  const countingDown = cooldown > 0;
  useEffect(() => {
    if (!countingDown) return;
    const id = setInterval(() => {
      setCooldown((c) => (c > 1 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [countingDown]);

  // 00080: signup reads the head-managed catalog. The anon key can SELECT the
  // active rows; if the request fails we keep the bundled DOrSU list so the
  // form is never blocked.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await getSupabase()
        .from('academic_options')
        .select('kind, faculty, label, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true });
      if (!alive || error || !data) return;
      const rows = data as {
        kind: string;
        faculty: string | null;
        label: string;
        sort_order: number;
      }[];
      const programRows = rows.filter((r) => r.kind === 'program' && !!r.faculty);
      const yearRows = rows.filter((r) => r.kind === 'year_level');
      if (programRows.length) {
        const groups: { faculty: string; programs: string[] }[] = [];
        for (const row of programRows) {
          const faculty = row.faculty as string;
          let group = groups.find((g) => g.faculty === faculty);
          if (!group) {
            group = { faculty, programs: [] };
            groups.push(group);
          }
          group.programs.push(row.label);
        }
        groups.sort((a, b) => a.faculty.localeCompare(b.faculty));
        setProgramGroups(groups);
      }
      if (yearRows.length) setYearLevels(yearRows.map((r) => r.label));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Google sign-up skips the email/password form, so the school details are
  // collected once here (`/register?google=1`) before the student reaches Home.
  // A student who logs in before those details exist (`?complete=1`) uses the
  // same one-step form.
  const params = useLocalSearchParams<{ google?: string; complete?: string }>();
  const finishingGoogle = params.google === '1';
  const finishingSetup = finishingGoogle || params.complete === '1';
  const [googleBusy, setGoogleBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (!finishingSetup) return;
    let cancelled = false;
    void (async () => {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      // Staff accounts cannot finish student setup, and a student who already
      // has their record complete belongs in the app, not on this form.
      const access = await resolveAccountAccess(supabase, user.id);
      if (cancelled) return;
      if (access.status === 'staff') {
        await supabase.auth.signOut().catch(() => undefined);
        router.replace({ pathname: '/blocked', params: blockedParams(access.role) });
        return;
      }
      if (access.status === 'student') {
        router.replace('/(tabs)/home');
        return;
      }

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        '';
      setGoogleProfile({ name, email: user.email ?? '' });

      // Prefill anything already saved (second visit or a partially filled row).
      const { data } = await supabase
        .from('students')
        .select('student_no, program, year_level')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as {
        student_no: string | null;
        program: string | null;
        year_level: string | null;
      };
      if (row.student_no) setStudentNo(row.student_no);
      if (row.program) setProgram(row.program);
      if (row.year_level) setYearLevel(row.year_level);
    })();
    return () => {
      cancelled = true;
    };
  }, [finishingSetup]);

  const google = async () => {
    setFieldError('');
    setServerError('');
    setGoogleBusy(true);
    try {
      // Sign-up only: an already-registered Google email is told to log in
      // instead of being signed into the account from this screen.
      const res = await continueWithGoogle('signup');
      if (res.status === 'cancelled') return;
      if (res.status === 'blocked') {
        router.replace({ pathname: '/blocked', params: blockedParams(res.role) });
        return;
      }
      if (res.status === 'already-registered') {
        setDialog({
          title: 'Account already exists',
          message: `This Google account${res.email ? ` (${res.email})` : ''} is already registered. Log in instead to pick up where you left off.`,
          icon: <LogIn size={20} color={colors.blue} />,
          note: 'If you started sign-up earlier, logging in finishes your student details.',
          actions: [
            { label: 'Log in', onPress: () => router.replace('/login') },
            { label: 'Stay here', variant: 'outline' },
          ],
        });
        return;
      }
      if (res.status === 'error') {
        setServerError(res.message);
        return;
      }
      // Defensive: the sign-in-only outcome cannot come from sign-up mode.
      if (res.status !== 'success') return;
      if (res.next === 'complete-profile') {
        router.replace({ pathname: '/register', params: { google: '1' } });
        return;
      }
      router.replace('/(tabs)/home');
    } finally {
      setGoogleBusy(false);
    }
  };

  /** One-time school details form (Google sign-up or an incomplete student record). */
  const finishSetup = async () => {
    setFieldError('');
    setServerError('');
    const no = registerStudentSchema.shape.studentNo.safeParse(studentNo.trim());
    if (!no.success) {
      setFieldError(no.error.issues[0]?.message ?? 'Check your student number.');
      return;
    }
    const prog = registerStudentSchema.shape.program.safeParse(program.trim());
    if (!prog.success) {
      setFieldError(prog.error.issues[0]?.message ?? 'Choose your program.');
      return;
    }
    const year = registerStudentSchema.shape.yearLevel.safeParse(yearLevel.trim());
    if (!year.success) {
      setFieldError(year.error.issues[0]?.message ?? 'Choose your year level.');
      return;
    }
    // Optional demographics — validate only when the student filled them in.
    let birth: string | undefined;
    if (birthdate.trim() !== '') {
      const b = registerStudentSchema.shape.birthdate.safeParse(birthdate.trim());
      if (!b.success) {
        setFieldError(b.error.issues[0]?.message ?? 'Check your birthdate.');
        return;
      }
      birth = b.data;
    }
    setFinishBusy(true);
    try {
      const saved = await saveStudentDetails(getSupabase(), {
        studentNo: no.data,
        program: prog.data,
        yearLevel: year.data,
        ...(gender ? { gender } : {}),
        ...(birth ? { birthdate: birth } : {}),
      });
      if (!saved.ok) {
        setServerError(friendlyDbError(saved.error));
        return;
      }
      router.replace('/(tabs)/home');
    } finally {
      setFinishBusy(false);
    }
  };

  const submit = async () => {
    setFieldError('');
    setServerError('');
    if (!isStrongPassword(pw)) {
      setFieldError(
        'Use a strong password — at least 8 characters with upper and lower case letters and a number.',
      );
      return;
    }
    const parsed = registerStudentSchema.safeParse({
      fullName: fullName.trim(),
      email: email.trim(),
      password: pw,
      studentNo: studentNo.trim(),
      program: program.trim(),
      yearLevel: yearLevel.trim(),
      gender: gender === '' ? undefined : gender,
      birthdate: birthdate.trim() === '' ? undefined : birthdate.trim(),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    if (confirm !== pw) {
      setFieldError("Those passwords don't match. Please try again.");
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const v = parsed.data;
      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
        options: {
          // Persist every registration field so `ensureStudentRows` can finish
          // the profiles/students rows after the email is confirmed.
          data: {
            full_name: v.fullName,
            student_no: v.studentNo,
            program: v.program,
            year_level: v.yearLevel,
            ...(v.gender ? { gender: v.gender } : {}),
            ...(v.birthdate ? { birthdate: v.birthdate } : {}),
          },
        },
      });
      if (error) {
        setServerError(friendlySignupError(error.message));
        return;
      }
      const user = data.user;
      if (!user) {
        setServerError('Registration failed. Please try again.');
        return;
      }
      // With confirmations ON, Supabase returns an empty identities array for
      // an already-registered email (anti-enumeration) instead of an error.
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        setServerError('An account with this email already exists. Try logging in instead.');
        return;
      }
      if (!data.session) {
        setAwaitingEmail(v.email);
        return;
      }
      const ensured = await ensureStudentRows(supabase, user.id, {
        email: v.email,
        fullName: v.fullName,
        studentNo: v.studentNo,
        program: v.program,
        yearLevel: v.yearLevel,
        ...(v.gender ? { gender: v.gender } : {}),
        ...(v.birthdate ? { birthdate: v.birthdate } : {}),
      });
      if (!ensured.ok) {
        if (ensured.notStudent) {
          await supabase.auth.signOut().catch(() => undefined);
          router.replace({ pathname: '/blocked', params: blockedParams(ensured.role) });
          return;
        }
        setServerError(
          /row-level security/i.test(ensured.error)
            ? 'Your account was created, but setup could not finish. Log in to complete it.'
            : friendlyDbError(ensured.error),
        );
        return;
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      setServerError(
        e instanceof Error ? friendlySignupError(e.message) : 'Registration failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const goLogin = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const programSearch = programQuery.trim().toLowerCase();
  // Match on the program name or the faculty heading, so typing "nursing" or
  // "teacher" still surfaces the right group.
  const visibleProgramGroups = programGroups.map((group) => {
    const facultyMatch = group.faculty.toLowerCase().includes(programSearch);
    return {
      faculty: group.faculty,
      programs: facultyMatch
        ? group.programs
        : group.programs.filter((p) => p.toLowerCase().includes(programSearch)),
    };
  }).filter((group) => group.programs.length > 0);
  const totalPrograms = programGroups.reduce((sum, g) => sum + g.programs.length, 0);
  const shownPrograms = visibleProgramGroups.reduce((sum, g) => sum + g.programs.length, 0);

  /** Step 1 of the wizard: account credentials. */
  const validateAccount = (): boolean => {
    setFieldError('');
    const name = registerStudentSchema.shape.fullName.safeParse(fullName.trim());
    if (!name.success) {
      setFieldError(name.error.issues[0]?.message ?? 'Enter your full name.');
      return false;
    }
    const mail = registerStudentSchema.shape.email.safeParse(email.trim());
    if (!mail.success) {
      setFieldError(mail.error.issues[0]?.message ?? 'Enter a valid university email.');
      return false;
    }
    if (!isStrongPassword(pw)) {
      setFieldError(
        'Use a strong password — at least 8 characters with upper and lower case letters and a number.',
      );
      return false;
    }
    if (confirm !== pw) {
      setFieldError("Those passwords don't match. Please try again.");
      return false;
    }
    return true;
  };

  /** Step 2 of the wizard: student number, program, year. */
  const validateSchool = (): boolean => {
    setFieldError('');
    const no = registerStudentSchema.shape.studentNo.safeParse(studentNo.trim());
    if (!no.success) {
      setFieldError(no.error.issues[0]?.message ?? 'Check your student number.');
      return false;
    }
    const prog = registerStudentSchema.shape.program.safeParse(program.trim());
    if (!prog.success) {
      setFieldError(prog.error.issues[0]?.message ?? 'Choose your program.');
      return false;
    }
    const year = registerStudentSchema.shape.yearLevel.safeParse(yearLevel.trim());
    if (!year.success) {
      setFieldError(year.error.issues[0]?.message ?? 'Choose your year level.');
      return false;
    }
    if (birthdate.trim() !== '') {
      const b = registerStudentSchema.shape.birthdate.safeParse(birthdate.trim());
      if (!b.success) {
        setFieldError(b.error.issues[0]?.message ?? 'Check your birthdate.');
        return false;
      }
    }
    return true;
  };

  const goToStep = (next: number) => {
    setFieldError('');
    setServerError('');
    setProgramOpen(false);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const nextStep = () => {
    if (validateAccount()) goToStep(1);
  };

  const onCreateAccount = () => {
    if (!validateSchool()) return;
    void submit();
  };

  const err = fieldError !== '' ? fieldError : serverError;
  const rise = intro.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const pulseScale = mailPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const pulseOpacity = mailPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const resendConfirmation = async () => {
    if (awaitingEmail === null || cooldown > 0 || resendState === 'sending') return;
    setResendState('sending');
    setResendError('');
    setOtpError('');
    try {
      // Re-sends the signup email, whose template carries the 6-digit token.
      const { error } = await getSupabase().auth.resend({ type: 'signup', email: awaitingEmail });
      if (error) {
        setResendState('error');
        setResendError(friendlySignupError(error.message));
        return;
      }
      setOtp('');
      setResendState('sent');
      setCooldown(60);
    } catch (e) {
      setResendState('error');
      setResendError(
        e instanceof Error ? friendlySignupError(e.message) : 'Could not resend the code. Try again.',
      );
    }
  };

  const verifyCode = async () => {
    if (awaitingEmail === null || otpBusy) return;
    const token = otp.replace(/\D/g, '');
    if (token.length !== 6) {
      setOtpError('Enter the 6-digit code from your email.');
      return;
    }
    setOtpBusy(true);
    setOtpError('');
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({
        email: awaitingEmail,
        token,
        type: 'signup',
      });
      if (error) {
        setOtpError(
          /expired|invalid|token|otp/i.test(error.message)
            ? 'That code is wrong or has expired. Request a new one.'
            : friendlySignupError(error.message),
        );
        return;
      }
      const user = data.user;
      if (!user) {
        setOtpError('Verification failed. Request a new code.');
        return;
      }
      // Everything collected at signup lives in the auth metadata, so finish
      // the profiles/students rows now that the session is authenticated.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const str = (key: string) =>
        typeof meta[key] === 'string' ? (meta[key] as string) : undefined;
      const ensured = await ensureStudentRows(supabase, user.id, {
        email: user.email ?? awaitingEmail,
        fullName: str('full_name') ?? '',
        studentNo: str('student_no'),
        program: str('program'),
        yearLevel: str('year_level'),
        ...(str('gender')
          ? { gender: str('gender') as 'male' | 'female' | 'prefer_not_to_say' }
          : {}),
        ...(str('birthdate') ? { birthdate: str('birthdate') } : {}),
      });
      if (!ensured.ok) {
        if (ensured.notStudent) {
          await supabase.auth.signOut().catch(() => undefined);
          router.replace({ pathname: '/blocked', params: blockedParams(ensured.role) });
          return;
        }
        setOtpError(
          /row-level security/i.test(ensured.error)
            ? 'Code accepted, but setup could not finish. Log in to complete it.'
            : friendlyDbError(ensured.error),
        );
        return;
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      setOtpError(
        e instanceof Error ? friendlySignupError(e.message) : 'Verification failed. Try again.',
      );
    } finally {
      setOtpBusy(false);
    }
  };

  const openMailApp = async () => {
    try {
      await Linking.openURL('mailto:');
    } catch {
      setResendState('error');
      setResendError('Open your email app and look for the Chekie code.');
    }
  };

  const startOver = () => {
    setAwaitingEmail(null);
    setResendState('idle');
    setResendError('');
    setOtp('');
    setOtpError('');
    setCooldown(0);
    goToStep(0);
  };

  if (awaitingEmail !== null) {
    const codeDigits = otp.replace(/\D/g, '');
    const canVerify = codeDigits.length === 6 && !otpBusy;

    return (
      <View style={styles.root} {...lumi.gaze}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.otpScreen}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.brandRow}>
                <ChekieMark size={40} />
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>Chekie</Text>
                  <Text style={styles.brandMeta}>DORSU GUIDANCE</Text>
                </View>
                <Pressable
                  onPress={() => router.replace('/login')}
                  hitSlop={hitSlop}
                  accessibilityRole="link"
                  accessibilityLabel="Log in"
                >
                  <Text style={styles.helpLink}>Log in</Text>
                </Pressable>
              </View>

              <View style={styles.otpHero}>
                <View style={styles.mailHalo}>
                  <Animated.View
                    style={[
                      styles.mailPulse,
                      { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                    ]}
                  />
                  <View style={styles.mailBadge}>
                    <Mail size={sizes.tabIcon + 14} color={colors.blue} />
                  </View>
                </View>
                <Text style={styles.otpEyebrow}>ACTIVATE ACCOUNT</Text>
                <Text style={styles.otpTitle}>Enter your code</Text>
                <Text style={styles.otpBody}>We emailed a 6-digit code to</Text>
                <View style={styles.emailPill}>
                  <Mail size={14} color={colors.blue} />
                  <Text style={styles.emailPillText} numberOfLines={1}>
                    {awaitingEmail}
                  </Text>
                </View>
              </View>

              <View style={styles.otpCard}>
                <Text style={styles.otpLabel}>Verification code</Text>
                <TextInput
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text.replace(/\D/g, '').slice(0, 6));
                    if (otpError !== '') setOtpError('');
                  }}
                  placeholder="000000"
                  placeholderTextColor={colors.border}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  textContentType="oneTimeCode"
                  accessibilityLabel="6-digit verification code"
                  style={[styles.otpInput, otpError !== '' && styles.otpInputError]}
                />
                {otpError !== '' ? <Text style={styles.otpError}>{otpError}</Text> : null}

                <PrimaryCta
                  label="Activate account"
                  busyLabel="Verifying…"
                  busy={otpBusy}
                  disabled={!canVerify}
                  onPress={() => void verifyCode()}
                  style={styles.otpCta}
                />

                <Pressable
                  onPress={() => void resendConfirmation()}
                  disabled={cooldown > 0 || resendState === 'sending'}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Resend code"
                  style={[styles.resendRow, cooldown > 0 && styles.resendOff]}
                >
                  {resendState === 'sending' ? (
                    <ActivityIndicator size="small" color={colors.blue} />
                  ) : (
                    <RotateCw size={15} color={cooldown > 0 ? colors.muted : colors.blue} />
                  )}
                  <Text style={[styles.resendText, cooldown > 0 && styles.resendTextOff]}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>

                {resendState === 'sent' ? (
                  <Text style={styles.otpSuccess}>New code sent. Check your inbox.</Text>
                ) : null}
                {resendState === 'error' && resendError !== '' ? (
                  <Text style={styles.otpError}>{resendError}</Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => void openMailApp()}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Open email app"
                style={styles.mailAppRow}
              >
                <Mail size={15} color={colors.muted} />
                <Text style={styles.mailAppText}>Open email app</Text>
              </Pressable>

              <Text style={styles.otpHint}>
                The code can take a minute. Check spam or promotions. Never share this code with
                anyone.
              </Text>

              <Pressable
                onPress={startOver}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Use a different email"
                style={styles.otpFooter}
              >
                <ChevronLeft size={sizes.tabIcon} color={colors.muted} />
                <Text style={styles.backText}>Use a different email</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  const checks = passwordChecks(pw);
  const score =
    (checks.length ? 1 : 0) +
    (checks.lower && checks.upper ? 1 : 0) +
    (checks.digit ? 1 : 0) +
    (pw.length >= 12 ? 1 : 0);
  const strengthLabel = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong';
  const segFill = score <= 1 ? colors.danger : score <= 3 ? colors.sun : colors.blue;
  const segText = score <= 1 ? colors.danger : score <= 3 ? colors.ink : colors.blue;

  const showAccountStep = !finishingSetup && step === 0;
  const showSchoolStep = finishingSetup || step === 1;
  const headingEyebrow = showAccountStep ? 'NEW STUDENT' : finishingSetup ? 'ONE MORE STEP' : 'SCHOOL DETAILS';
  const headingTitle = showAccountStep ? 'Create account.' : finishingSetup ? 'Finish setup.' : 'Almost there.';
  const headingHelper = showAccountStep
    ? 'Students only — staff accounts are issued by Guidance.'
    : finishingSetup
      ? 'Add your school details once and you are set.'
      : 'Tell us where you study so Guidance can match your records.';

  return (
    <View style={styles.root} {...lumi.gaze}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[styles.stack, { opacity: intro, transform: [{ translateY: rise }] }]}
            >
              <View style={styles.brandRow}>
                <ChekieMark size={40} />
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>Chekie</Text>
                  <Text style={styles.brandMeta}>DORSU GUIDANCE</Text>
                </View>
                {!finishingSetup ? (
                  <Pressable
                    onPress={goLogin}
                    hitSlop={hitSlop}
                    accessibilityRole="link"
                    accessibilityLabel="Log in instead"
                  >
                    <Text style={styles.helpLink}>Log in</Text>
                  </Pressable>
                ) : null}
              </View>

              {!finishingSetup ? (
                <View style={styles.progressRow}>
                  <View style={styles.progressSegments}>
                    {Array.from({ length: STEP_COUNT }).map((_, i) => (
                      <View
                        key={`step-${i}`}
                        style={[styles.progressSeg, i <= step && styles.progressSegOn]}
                      />
                    ))}
                  </View>
                  <Text style={styles.progressText}>
                    Step {step + 1} of {STEP_COUNT}
                  </Text>
                </View>
              ) : null}

              <View style={styles.heroRow}>
                <View style={styles.heroCopy}>
                  <View style={styles.eyebrowRow}>
                    <View style={styles.eyebrowDot} />
                    <Text style={styles.eyebrow}>{headingEyebrow}</Text>
                  </View>
                  <Text style={styles.title}>{headingTitle}</Text>
                  <Text style={styles.helper}>{headingHelper}</Text>
                </View>
                <Mascot controller={lumi} size={64} />
              </View>

              <View style={styles.card}>
                {finishingSetup ? (
                  <View style={styles.googleNotice}>
                    <View style={styles.googleNoticeIcon}>
                      <User size={sizes.tabIcon} color={colors.blue} />
                    </View>
                    <View style={styles.googleNoticeCopy}>
                      <Text style={styles.googleNoticeTitle} numberOfLines={1}>
                        {googleProfile?.name || (finishingGoogle ? 'Google account' : 'Your account')}
                      </Text>
                      {googleProfile?.email ? (
                        <Text style={styles.googleNoticeEmail} numberOfLines={1}>
                          {googleProfile.email}
                        </Text>
                      ) : null}
                    </View>
                    <Check size={sizes.tabIcon} color={colors.blue} />
                  </View>
                ) : null}

                {showAccountStep ? (
                  <>
                    <GoogleButton
                      label="Sign up with Google"
                      onPress={() => void google()}
                      busy={googleBusy}
                      disabled={busy}
                    />
                    <OrDivider label="OR SIGN UP WITH EMAIL" />

                    <Field
                      label="Full name"
                      placeholder="e.g. Maria Santos"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      icon={<User size={sizes.tabIcon} color={colors.muted} />}
                    />
                    <Field
                      label="University email"
                      placeholder="you@student.dorsu.edu.ph"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      keyboardType="email-address"
                      icon={<Mail size={sizes.tabIcon} color={colors.muted} />}
                    />
                    <Field
                      label="Password"
                      placeholder="••••••"
                      value={pw}
                      onChangeText={setPw}
                      secureTextEntry={!showPw}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      icon={<Lock size={sizes.tabIcon} color={colors.muted} />}
                      trailing={
                        <Pressable
                          onPress={() => setShowPw((s) => !s)}
                          hitSlop={hitSlop}
                          accessibilityRole="button"
                          accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? (
                            <EyeOff size={sizes.tabIcon} color={colors.blue} />
                          ) : (
                            <Eye size={sizes.tabIcon} color={colors.muted} />
                          )}
                        </Pressable>
                      }
                    />
                    {pw !== '' ? (
                      <View>
                        <View style={styles.meter}>
                          {[0, 1, 2, 3].map((i) => (
                            <View
                              key={`seg-${i}`}
                              style={[styles.meterSeg, i < score && { backgroundColor: segFill }]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.meterLabel, { color: segText }]}>
                          Password strength: {strengthLabel}
                        </Text>
                        <View style={styles.reqs}>
                          <ReqRow met={checks.length} text="At least 8 characters" />
                          <ReqRow met={checks.lower && checks.upper} text="Upper and lower case letters" />
                          <ReqRow met={checks.digit} text="At least one number" />
                        </View>
                      </View>
                    ) : null}
                    <Field
                      label="Confirm password"
                      placeholder="••••••"
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      icon={<Lock size={sizes.tabIcon} color={colors.muted} />}
                      trailing={
                        <Pressable
                          onPress={() => setShowConfirm((s) => !s)}
                          hitSlop={hitSlop}
                          accessibilityRole="button"
                          accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirm ? (
                            <EyeOff size={sizes.tabIcon} color={colors.blue} />
                          ) : (
                            <Eye size={sizes.tabIcon} color={colors.muted} />
                          )}
                        </Pressable>
                      }
                    />
                  </>
                ) : null}

                {showSchoolStep ? (
                  <>
                    <Field
                      label="Student number"
                      placeholder="e.g. 2021-0001"
                      value={studentNo}
                      onChangeText={(text) => setStudentNo(formatStudentNoInput(text))}
                      keyboardType="number-pad"
                      maxLength={9}
                      icon={<IdCard size={sizes.tabIcon} color={colors.muted} />}
                    />
                    <Text style={styles.fieldHint}>Format: 20YY-XXXX (e.g. 2021-0001)</Text>

                    <View>
                      <Text style={styles.label}>Program</Text>
                      {/* Static style array (not a function style): NativeWind's
                          native JSX wrapper can drop function styles on
                          Pressable, which is what removed the border and row
                          layout on device. */}
                      <Pressable
                        onPress={() => {
                          setProgramOpen((open) => {
                            if (!open) setProgramQuery('');
                            return !open;
                          });
                        }}
                        hitSlop={hitSlop}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: programOpen }}
                        accessibilityLabel="Select your program"
                        style={[styles.select, programOpen ? styles.selectOpen : null]}
                      >
                        <View style={styles.selectIcon}>
                          <BookOpen size={sizes.tabIcon} color={colors.muted} />
                        </View>
                        <Text
                          style={[styles.selectText, program === '' && styles.selectPlaceholder]}
                          numberOfLines={2}
                          maxFontSizeMultiplier={1.3}
                        >
                          {program === '' ? 'Select your program' : program}
                        </Text>
                        <View
                          style={{ transform: [{ rotate: programOpen ? '180deg' : '0deg' }] }}
                        >
                          <ChevronDown size={sizes.tabIcon} color={colors.muted} />
                        </View>
                      </Pressable>

                      {/* Inline picker — intentionally not a modal, so the list
                          can never be clipped or hidden behind the keyboard. */}
                      {programOpen ? (
                        <View style={styles.picker}>
                          <View style={styles.searchRow}>
                            <Search size={sizes.tabIcon} color={colors.muted} />
                            <TextInput
                              value={programQuery}
                              onChangeText={setProgramQuery}
                              placeholder="Search program or faculty"
                              placeholderTextColor={colors.muted}
                              autoCapitalize="none"
                              autoCorrect={false}
                              returnKeyType="search"
                              style={styles.searchInput}
                            />
                            {programQuery !== '' ? (
                              <Pressable
                                onPress={() => setProgramQuery('')}
                                hitSlop={hitSlop}
                                accessibilityRole="button"
                                accessibilityLabel="Clear search"
                              >
                                <X size={sizes.tabIcon} color={colors.muted} />
                              </Pressable>
                            ) : null}
                          </View>

                          <Text style={styles.pickerMeta}>
                            {programSearch === ''
                              ? `${totalPrograms} DOrSU programs`
                              : `${shownPrograms} of ${totalPrograms} programs`}
                          </Text>

                          {visibleProgramGroups.length === 0 ? (
                            <View style={styles.emptyWrap}>
                              <View style={styles.emptyIcon}>
                                <Search size={sizes.tabIcon} color={colors.muted} />
                              </View>
                              <Text style={styles.emptyTitle}>No matching programs</Text>
                              <Text style={styles.emptyPrograms}>
                                Nothing matches “{programQuery.trim()}”. Try a shorter search.
                              </Text>
                            </View>
                          ) : (
                            visibleProgramGroups.map((group) => (
                              <View key={group.faculty} style={styles.programGroup}>
                                <Text style={styles.programGroupTitle}>{group.faculty}</Text>
                                <View style={styles.programList}>
                                  {group.programs.map((p) => {
                                    const on = program === p;
                                    return (
                                      <Pressable
                                        key={p}
                                        onPress={() => {
                                          setProgram(p);
                                          setProgramOpen(false);
                                          setProgramQuery('');
                                        }}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: on }}
                                        style={[styles.option, on && styles.optionOn]}
                                      >
                                        <Text
                                          style={[styles.optionText, on && styles.optionTextOn]}
                                        >
                                          {p}
                                        </Text>
                                        <View
                                          style={[styles.optionCheck, on && styles.optionCheckOn]}
                                        >
                                          {on ? <Check size={13} color={colors.white} /> : null}
                                        </View>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      ) : null}
                    </View>

                    <View>
                      <Text style={styles.label}>Year level</Text>
                      <View style={styles.chipGrid}>
                        {yearLevels.map((y) => (
                          <Chip
                            key={y}
                            label={y}
                            selected={yearLevel === y}
                            onPress={() => setYearLevel(y)}
                            style={styles.chip}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Optional demographics (00079) — lets the Guidance Office's
                        referral form autofill gender and age instead of asking again.
                        Leaving both blank is fine. */}
                    <Pressable
                      onPress={() => setOptionalOpen((open) => !open)}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: optionalOpen }}
                      style={styles.optionalToggle}
                    >
                      <View style={styles.optionalIcon}>
                        <User size={14} color={colors.blue} />
                      </View>
                      <View style={styles.optionalCopy}>
                        <Text style={styles.optionalTitle}>Personal details</Text>
                        <Text style={styles.optionalSub}>
                          Optional — helps Guidance autofill referrals.
                        </Text>
                      </View>
                      <View style={{ transform: [{ rotate: optionalOpen ? '180deg' : '0deg' }] }}>
                        <ChevronDown size={sizes.tabIcon} color={colors.muted} />
                      </View>
                    </Pressable>

                    {optionalOpen ? (
                      <View style={styles.optionalBody}>
                        <View>
                          <Text style={styles.label}>Gender (optional)</Text>
                          <View style={styles.chipGrid}>
                            {GENDER_OPTIONS.map((g) => (
                              <Chip
                                key={g.value}
                                label={g.label}
                                selected={gender === g.value}
                                onPress={() => setGender(gender === g.value ? '' : g.value)}
                                style={styles.chip}
                              />
                            ))}
                          </View>
                          <Text style={styles.optionalHint}>
                            Shared only with the Guidance Office for referrals and counseling records.
                          </Text>
                        </View>
                        <Field
                          label="Birthdate (optional)"
                          placeholder="YYYY-MM-DD"
                          value={birthdate}
                          onChangeText={(text) => setBirthdate(formatBirthdateInput(text))}
                          keyboardType="numbers-and-punctuation"
                          maxLength={10}
                        />
                        <Text style={styles.fieldHint}>
                          Any valid date from 2000 up to today.
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {err !== '' ? (
                  <View style={styles.errorBanner}>
                    <TriangleAlert size={sizes.tabIcon} color={colors.danger} />
                    <Text style={styles.errorText}>{err}</Text>
                  </View>
                ) : null}

                <PrimaryCta
                  label={
                    finishingSetup ? 'Finish setup' : showAccountStep ? 'Continue' : 'Create account'
                  }
                  busyLabel={
                    finishingSetup ? 'Saving…' : showAccountStep ? 'Please wait…' : 'Creating account…'
                  }
                  busy={finishingSetup ? finishBusy : busy}
                  disabled={busy || googleBusy || finishBusy}
                  onPress={() => {
                    if (finishingSetup) void finishSetup();
                    else if (showAccountStep) nextStep();
                    else onCreateAccount();
                  }}
                  style={styles.submit}
                />
              </View>

              {!finishingSetup && step === 1 ? (
                <Pressable
                  onPress={() => goToStep(0)}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Back to account details"
                  style={styles.backRow}
                >
                  <ChevronLeft size={sizes.tabIcon} color={colors.muted} />
                  <Text style={styles.backText}>Back to account details</Text>
                </Pressable>
              ) : null}

              {!finishingSetup ? (
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account?</Text>
                  <Pressable hitSlop={hitSlop} accessibilityRole="link" onPress={goLogin}>
                    <Text style={styles.footerLink}>Log in</Text>
                  </Pressable>
                </View>
              ) : null}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  stack: { gap: spacing.md },

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

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressSegments: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressSegOn: { backgroundColor: colors.blue },
  progressText: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.muted },

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

  label: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.ink, marginBottom: spacing.xs },
  fieldHint: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  optionalHint: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 16,
  },
  select: {
    minHeight: 52,
    borderRadius: buttonRadius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectIcon: {
    width: sizes.tabIcon + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectOpen: { borderColor: colors.blue },
  selectText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  selectPlaceholder: { color: colors.muted },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexGrow: 1, flexBasis: '45%' },

  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  optionalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionalCopy: { flex: 1, gap: 1 },
  optionalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  optionalSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  optionalBody: { gap: spacing.sm, paddingTop: spacing.xs },

  googleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  googleNoticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleNoticeCopy: { flex: 1, gap: 1 },
  googleNoticeTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  googleNoticeEmail: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },

  meter: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  meterSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  meterLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, marginTop: spacing.xs },
  reqs: { marginTop: spacing.xs, gap: spacing.xs },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reqText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  reqTextMet: { color: colors.ink },

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
  submit: { marginTop: spacing.xs },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  backText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.muted },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  footerLink: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },

  otpScreen: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  otpHero: { alignItems: 'center', gap: spacing.xs },
  mailHalo: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  mailPulse: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.sky,
  },
  mailBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  otpEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
    letterSpacing: 1.6,
    marginTop: spacing.xs,
  },
  otpTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.ink,
    textAlign: 'center',
  },
  otpBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    maxWidth: '100%',
    marginTop: 2,
  },
  emailPillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
    flexShrink: 1,
  },
  otpCard: {
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...cardShadow,
  },
  otpLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.ink },
  otpInput: {
    height: 58,
    borderRadius: buttonRadius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: 28,
    letterSpacing: 10,
    color: colors.ink,
    paddingHorizontal: spacing.sm,
    includeFontPadding: false,
  },
  otpInputError: { borderColor: colors.danger },
  otpError: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.danger,
  },
  otpSuccess: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.blue,
  },
  otpCta: { marginTop: spacing.xs },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  resendOff: { opacity: 0.7 },
  resendText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },
  resendTextOff: { color: colors.muted },
  mailAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    marginTop: -spacing.xs,
  },
  mailAppText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.muted },
  otpHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  otpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },

  picker: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  pickerMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
    marginTop: 2,
  },
  searchRow: {
    height: 44,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.chip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.ink,
    padding: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  programGroup: { gap: spacing.xs },
  programGroupTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  programList: { gap: spacing.xs },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  emptyPrograms: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionOn: { backgroundColor: colors.sky, borderColor: colors.blue },
  optionText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: colors.ink,
  },
  optionTextOn: { fontFamily: fontFamily.bold, color: colors.ink },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckOn: { backgroundColor: colors.blue, borderColor: colors.blue },
});
