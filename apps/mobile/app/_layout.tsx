import { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@/theme';
import { NotificationsProvider } from '@/lib/notifications-context';
import { SessionReminderBanner } from '@/components/SessionReminderBanner';
import {
  useFonts,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded || timedOut || fontError !== null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/* RN 0.88 (SDK 58) is edge-to-edge on Android; backgroundColor/translucent were removed. */}
      <StatusBar barStyle="dark-content" />
      <NotificationsProvider>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.white },
            }}
          >
            {/* Dock destinations and anything that returns to the dock switch
                with zero animation, so tapping a tab paints immediately. A
                native-stack pop animates the screen being dismissed, so each
                of these also needs its own `none`. */}
            <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            <Stack.Screen name="book" options={{ animation: 'none' }} />
            <Stack.Screen name="chat" options={{ animation: 'none' }} />
            <Stack.Screen name="check-in" options={{ animation: 'none' }} />
            <Stack.Screen name="notifications" options={{ animation: 'none' }} />
            <Stack.Screen name="announcements" options={{ animation: 'none' }} />
          </Stack>
          {/* Root-level so the 30-minute session reminder shows on every screen. */}
          <SessionReminderBanner />
        </View>
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
