import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import { getSupabase } from '@/lib/supabase/client';
import { roleLabel } from '@/lib/supabase/accountAccess';
import { colors, cardRadius, cardShadow, fontFamily, fontSize, spacing, hitSlop } from '@/theme';
import { Button } from '@/components/Button';
import { ChekieMark } from '@/components/ChekieMark';
import { SunCorner } from '@/components/illustrations/SunCorner';

/**
 * Dead end for a staff account on the student app.
 *
 * Reached only through `router.replace`, and the session is already signed out
 * by the caller, so the device does not keep a counselor/admin session around.
 * Wording points staff to the web portal instead of leaving them to guess.
 */
export default function Blocked() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [busy, setBusy] = useState(false);

  const backToLogin = async () => {
    if (busy) return;
    setBusy(true);
    // Belt and braces: never leave a non-student session on the device.
    await getSupabase().auth.signOut().catch(() => undefined);
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <View style={styles.decorSun} pointerEvents="none">
        <SunCorner size={260} />
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <ChekieMark size={40} />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>Chekie</Text>
              <Text style={styles.brandMeta}>DORSU GUIDANCE</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.iconBubble}>
              <ShieldAlert size={30} color={colors.danger} />
            </View>
            <Text style={styles.eyebrow}>STAFF ACCOUNT DETECTED</Text>
            <Text style={styles.title}>This is not a student account.</Text>
            <Text style={styles.body}>
              You signed in with a{' '}
              <Text style={styles.bodyStrong}>{roleLabel(params.role)}</Text> account. The Chekie
              mobile app is for students only.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Where to go next</Text>
            <Text style={styles.cardBody}>
              Please proceed to the Chekie website and sign in there — counselors, guidance heads,
              faculty, and admins run the Guidance Office from the web portal.
            </Text>
            <View style={styles.divider} />
            <Text style={styles.cardHint}>
              Looking for your own student sessions? Log in with your student account instead.
            </Text>
          </View>

          <Button label="Back to log in" onPress={() => void backToLogin()} disabled={busy} />
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={colors.blue} />
              <Text style={styles.busyText}>Signing out…</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.replace('/login')}
              hitSlop={hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Go to the log in screen"
            >
              <Text style={styles.help}>Use a different account</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  decorSun: { position: 'absolute', top: -90, right: -80, opacity: 0.38 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
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

  hero: { gap: spacing.xs },
  iconBubble: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.danger,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 20,
    color: colors.muted,
  },
  bodyStrong: { fontFamily: fontFamily.bold, color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    ...cardShadow,
  },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  cardBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm + 5,
    color: colors.muted,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  cardHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 5,
    color: colors.muted,
  },

  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  busyText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.muted },
  help: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.blue,
    textAlign: 'center',
  },
});
