import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Tap → screen, with nothing in between: no fade to sit through.
        animation: 'none',
        // Every tab is mounted up front, so the switch is a paint rather than a
        // cold mount of a heavy screen (which is what reads as "delay").
        lazy: false,
        sceneStyle: { backgroundColor: colors.white },
      }}
      tabBar={() => <TabBar />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="sessions" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
