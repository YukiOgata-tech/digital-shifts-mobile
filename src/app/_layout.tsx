import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { SplashScreenController } from '@/components/auth/splash-screen-controller';
import { PushNotificationObserver } from '@/components/notifications/push-notification-observer';
import { NotificationRealtimeObserver } from '@/components/notifications/notification-realtime-observer';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { StaffProvider } from '@/features/staff/staff-provider';
import { AppQueryProvider } from '@/lib/query-provider';

export default function RootLayout() {
  return (
    <AppQueryProvider>
      <SessionProvider>
        <SplashScreenController />
        <StaffProvider>
          <NotificationRealtimeObserver />
          <PushNotificationObserver />
          <RootNavigator />
        </StaffProvider>
      </SessionProvider>
    </AppQueryProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="(staff)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: '通知', presentation: 'modal' }} />
          <Stack.Screen name="help" options={{ title: 'ヘルプ募集', presentation: 'card' }} />
          <Stack.Screen name="shift-request" options={{ title: '希望シフト入力' }} />
          <Stack.Screen
            name="attendance-adjustment"
            options={{
              title: '勤怠の後から入力',
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.65, 1],
            }}
          />
          <Stack.Screen name="profile" options={{ title: 'プロフィールと設定' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
