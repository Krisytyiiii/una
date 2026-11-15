import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './client';
import { readAccountRole, STUDENT_ROLE } from './accountAccess';
import { finishOAuthAccount } from './studentSetup';

/**
 * Google means different things on the two auth screens:
 *
 * - `signin`: only an account that already exists may enter. A Google email
 *   with no Chekie account is signed straight back out and told to sign up.
 * - `signup`: only a Google email that is *not* registered yet may continue.
 *   An existing account is signed out and told to log in instead.
 *
 * Neither mode ever converts a staff account into a student one.
 */
export type GoogleAuthMode = 'signin' | 'signup';

export type GoogleAuthOutcome =
  | { status: 'success'; next: 'home' | 'complete-profile'; fullName: string }
  /** Staff account — the session is already signed out on the device. */
  | { status: 'blocked'; role: string }
  /** Sign-in only: this Google email has never been registered. */
  | { status: 'no-account'; email: string }
  /** Sign-up only: this Google email already has a Chekie account. */
  | { status: 'already-registered'; email: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * Deep link Supabase sends the in-app browser back to.
 * Dev builds: dorsu-mental://auth/callback
 * Expo Go:   exp://<host>/--/auth/callback
 * Both must be allowlisted in Supabase → Auth → URL Configuration.
 */
export function googleRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

/**
 * The OS sometimes hands the OAuth redirect to expo-router instead of the
 * in-app browser (`app/auth/callback.tsx`). That screen cannot know which
 * button started the flow, so the mode is parked in storage until the
 * callback consumes it.
 */
const GOOGLE_MODE_KEY = '@dorsu-mobile:google-mode';

async function rememberGoogleMode(mode: GoogleAuthMode): Promise<void> {
  try {
    await AsyncStorage.setItem(GOOGLE_MODE_KEY, mode);
  } catch {
    // Non-fatal: the callback screen defaults to the safer sign-in mode.
  }
}

/** Read (and clear) the mode recorded when the provider was opened. */
export async function consumeGoogleMode(): Promise<GoogleAuthMode> {
  try {
    const saved = await AsyncStorage.getItem(GOOGLE_MODE_KEY);
    await AsyncStorage.removeItem(GOOGLE_MODE_KEY);
    return saved === 'signup' ? 'signup' : 'signin';
  } catch {
    return 'signin';
  }
}

function readParam(url: string, key: string): string | null {
  const { queryParams } = Linking.parse(url);
  const value = queryParams?.[key];
  return typeof value === 'string' ? value : null;
}

function friendlyOAuthError(message: string): string {
  if (/access_denied|cancel/i.test(message)) return 'Google sign-in was cancelled.';
  if (/provider is not enabled|unsupported provider|validation_failed/i.test(message)) {
    return 'Google sign-in is not enabled yet. Please use email or contact the Guidance Office.';
  }
  if (/already.*(registered|exists)|email.*already/i.test(message)) {
    return 'This email already has an account. Log in with your email and password instead.';
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return message;
}

/**
 * Same behaviour as the web "Continue with Google" button, but for a native
 * app: open the provider in an in-app browser, catch the PKCE code on the
 * deep link, exchange it for a session, then apply the screen's mode.
 */
export async function continueWithGoogle(mode: GoogleAuthMode): Promise<GoogleAuthOutcome> {
  const supabase = getSupabase();
  const redirectTo = googleRedirectUrl();
  const startedAt = Date.now();

  // Which URL Supabase must be allowed to return to — this is the value that
  // has to exist in Authentication → URL Configuration for the current runtime
  // (`dorsu-mental://…` for dev/production builds, `exp://…` in Expo Go, an
  // `http://localhost:8081/…` origin in the web preview).
  if (__DEV__) console.log('[google] redirectTo =', redirectTo);

  // Recorded before the browser opens so `app/auth/callback.tsx` can apply the
  // same sign-in / sign-up rule when Android routes the deep link to the app.
  await rememberGoogleMode(mode);

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // We open the URL ourselves so the app keeps control of the callback.
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { status: 'error', message: friendlyOAuthError(error.message) };
    if (!data?.url) {
      return { status: 'error', message: "Google sign-in couldn't start. Please try again." };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      // A real cancel closes almost immediately. A slower dismissal usually
      // means Google finished and Supabase sent the browser to its Site URL
      // (the website) because `redirectTo` is not in the allow list — surface
      // that exact URL while developing instead of failing silently.
      if (__DEV__ && result.type === 'dismiss' && Date.now() - startedAt > 4000) {
        const lanIp = /^exp:\/\/(\d{1,3}(?:\.\d{1,3}){3})/.test(redirectTo);
        return {
          status: 'error',
          message: lanIp
            ? `Google sent the browser to the website instead of the app. Expo Go over LAN generates ${redirectTo}, and Supabase's exp://** entry does not match raw IP hosts. Restart with "npx expo start --tunnel", or add ${redirectTo} in Supabase → Authentication → URL Configuration → Redirect URLs.`
            : `Google sent the browser to the website instead of the app. Add this URL in Supabase → Authentication → URL Configuration → Redirect URLs: ${redirectTo}`,
        };
      }
      return { status: 'cancelled' };
    }
    if (result.type !== 'success') {
      return { status: 'error', message: "Google sign-in didn't finish. Please try again." };
    }

    const oauthError = readParam(result.url, 'error_description') ?? readParam(result.url, 'error');
    if (oauthError) return { status: 'error', message: friendlyOAuthError(oauthError) };

    const code = readParam(result.url, 'code');
    if (!code) {
      return { status: 'error', message: "Google didn't send a sign-in code. Please try again." };
    }

    const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    // Android can hand the same deep link to `app/auth/callback.tsx`, which may
    // have exchanged this single-use code first. If a session now exists, this
    // path simply continues from it.
    let account = exchanged?.user ?? null;
    if (exchangeError || !account) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      account = session?.user ?? null;
    }
    if (!account) {
      return {
        status: 'error',
        message: friendlyOAuthError(
          exchangeError?.message ?? "Google sign-in didn't return an account. Please try again.",
        ),
      };
    }

    const signOut = () => supabase.auth.signOut().catch(() => undefined);
    const email = account.email ?? '';

    // Supabase creates an auth user for any Google account. A `profiles` row is
    // what makes it a Chekie account; check it before `students` is touched.
    const lookup = await readAccountRole(supabase, account.id);
    if (!lookup.ok) {
      await signOut();
      return { status: 'error', message: friendlyOAuthError(lookup.error) };
    }

    const role = lookup.role;
    const hasAccount = role !== null;

    if (hasAccount && role !== STUDENT_ROLE) {
      await signOut();
      return { status: 'blocked', role };
    }
    if (!hasAccount && mode === 'signin') {
      await signOut();
      return { status: 'no-account', email };
    }
    if (hasAccount && mode === 'signup') {
      await signOut();
      return { status: 'already-registered', email };
    }

    // Sign-in with an existing student (finish any missing row), or sign-up
    // with a fresh Google email (create the rows for the first time).
    const setup = await finishOAuthAccount(supabase);
    if (!setup.ok) {
      if (setup.blocked) {
        // Never keep a staff session on the student app.
        await signOut();
        return { status: 'blocked', role: setup.role };
      }
      return { status: 'error', message: setup.error };
    }

    return {
      status: 'success',
      next: setup.needsStudentDetails ? 'complete-profile' : 'home',
      fullName: setup.fullName,
    };
  } catch (e) {
    return {
      status: 'error',
      message: friendlyOAuthError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.'),
    };
  }
}
