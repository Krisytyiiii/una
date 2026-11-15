import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import LogIn from 'lucide-react-native/icons/log-in';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import UserX from 'lucide-react-native/icons/user-x';
import { getSupabase } from '@/lib/supabase/client';
import {
  blockedParams,
  readAccountRole,
  STUDENT_ROLE,
} from '@/lib/supabase/accountAccess';
import { consumeGoogleMode } from '@/lib/supabase/googleAuth';
import { finishOAuthAccount } from '@/lib/supabase/studentSetup';
import { colors, cardRadius, cardShadow, fontFamily, fontSize, spacing, hitSlop } from '@/theme';
import { Button } from '@/components/Button';
import { ChekieMark } from '@/components/ChekieMark';

type Notice =
  | { kind: 'no-account'; email: string }
  | { kind: 'already-registered'; email: string }
  | { kind: 'error'; message: string };

/**
 * OAuth return point: `dorsu-mental://auth/callback?code=…`.
 *
 * Normally `WebBrowser.openAuthSessionAsync` intercepts that URL and
 * `continueWithGoogle` finishes the exchange itself. On Android (and when the
 * app is cold-started) the OS can hand the same deep link to expo-router
 * instead — without this route that lands on "Unmatched Route". The exchange
 * is single-use, so this screen is also safe when it runs instead of the
 * browser path: a missing/used code falls back to the session that was just
 * created.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const started = useRef(false);

  const finish = async () => {
    const supabase = getSupabase();
    const signOut = () => supabase.auth.signOut().catch(() => undefined);

    try {
      const oauthError =
        (typeof params.error_description === 'string' && params.error_description) ||
        (typeof params.error === 'string' && params.error) ||
        '';
      if (oauthError) {
        setNotice({ kind: 'error', message: friendlyCallbackError(oauthError) });
        return;
      }

      let userId: string | null = null;
      let email = '';
      const code = typeof params.code === 'string' ? params.code : '';

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.user) {
          userId = data.user.id;
          email = data.user.email ?? '';
        }
      }

      if (!userId) {
        // The browser path may already have exchanged the code.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
        email = session?.user?.email ?? email;
      }

      if (!userId) {
        setNotice({
          kind: 'error',
          message: 'The sign-in link expired or was already used. Please try signing in again.',
        });
        return;
      }

      // The screen that started the flow decides whether this Google email is
      // allowed to enter (sign-in) or must be new (sign-up).
      const mode = await consumeGoogleMode();
      const lookup = await readAccountRole(supabase, userId);
      if (!lookup.ok) {
        setNotice({ kind: 'error', message: friendlyCallbackError(lookup.error) });
        return;
      }

      const role = lookup.role;
      const hasAccount = role !== null;

      if (hasAccount && role !== STUDENT_ROLE) {
        await signOut();
        router.replace({ pathname: '/blocked', params: blockedParams(role) });
        return;
      }
      if (!hasAccount && mode === 'signin') {
        await signOut();
        setNotice({ kind: 'no-account', email });
        return;
      }
      if (hasAccount && mode === 'signup') {
        await signOut();
        setNotice({ kind: 'already-registered', email });
        return;
      }

      const setup = await finishOAuthAccount(supabase);
      if (!setup.ok) {
        if (setup.blocked) {
          await signOut();
          router.replace({ pathname: '/blocked', params: blockedParams(setup.role) });
          return;
        }
        setNotice({ kind: 'error', message: setup.error });
        return;
      }

      if (!setup.needsStudentDetails) {
        router.replace('/(tabs)/home');
        return;
      }
      router.replace({
        pathname: '/register',
        params: mode === 'signup' ? { google: '1' } : { complete: '1' },
      });
    } catch (e) {
      setNotice({
        kind: 'error',
        message: friendlyCallbackError(e instanceof Error ? e.message : 'Sign-in failed.'),
      });
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void finish();
    // Runs once: the code is single-use and the params never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!notice) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.content}>
            <ChekieMark size={44} />
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.workingTitle}>Finishing sign-in…</Text>
            <Text style={styles.workingBody}>Hold on while we open your Chekie account.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <ChekieMark size={40} />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>Chekie</Text>
              <Text style={styles.brandMeta}>DORSU GUIDANCE</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View
              style={[
                styles.iconBubble,
                notice.kind === 'error' && { backgroundColor: colors.dangerSoft },
              ]}
            >
              {notice.kind === 'no-account' ? (
                <UserX size={24} color={colors.blue} />
              ) : notice.kind === 'already-registered' ? (
                <LogIn size={24} color={colors.blue} />
              ) : (
                <TriangleAlert size={24} color={colors.danger} />
              )}
            </View>

            {notice.kind === 'no-account' ? (
              <>
                <Text style={styles.title}>No account found</Text>
                <Text style={styles.body}>
                  This Google account
                  {notice.email ? ` (${notice.email})` : ''} isn&apos;t registered yet. Create a
                  student account first — it only takes a minute.
                </Text>
                <Button
                  label="Create student account"
                  onPress={() => router.replace('/register')}
                />
                <Pressable
                  onPress={() => router.replace('/login')}
                  hitSlop={hitSlop}
                  accessibilityRole="link"
                >
                  <Text style={styles.link}>Back to log in</Text>
                </Pressable>
              </>
            ) : notice.kind === 'already-registered' ? (
              <>
                <Text style={styles.title}>Account already exists</Text>
                <Text style={styles.body}>
                  This Google account
                  {notice.email ? ` (${notice.email})` : ''} is already registered. Log in instead
                  to pick up where you left off.
                </Text>
                <Button label="Log in" onPress={() => router.replace('/login')} />
                <Pressable
                  onPress={() => router.replace('/register')}
                  hitSlop={hitSlop}
                  accessibilityRole="link"
                >
                  <Text style={styles.link}>Stay on sign-up</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title}>Sign-in didn&apos;t finish</Text>
                <Text style={styles.body}>{notice.message}</Text>
                <Button label="Back to log in" onPress={() => router.replace('/login')} />
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function friendlyCallbackError(message: string): string {
  if (/access_denied|cancel/i.test(message)) return 'Google sign-in was cancelled.';
  if (/expired|invalid|already used/i.test(message)) {
    return 'That sign-in link has expired. Please try again.';
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return message;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  workingTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  workingBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm + 5,
    color: colors.muted,
    textAlign: 'center',
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

  card: {
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...cardShadow,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl + 4,
    color: colors.ink,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm + 6,
    color: colors.muted,
  },
  link: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.blue,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
