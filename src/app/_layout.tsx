import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashScreenController } from '@/components/auth/splash-screen-controller';
import { StaffAppHeader } from '@/components/navigation/staff-app-header';
import { PushNotificationObserver } from '@/components/notifications/push-notification-observer';
import { NotificationRealtimeObserver } from '@/components/notifications/notification-realtime-observer';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { StaffProvider } from '@/features/staff/staff-provider';
import { AppQueryProvider } from '@/lib/query-provider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
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
      <View style={{ flex: 1 }}>
        <StatusBar style="auto" />
        {session ? <StaffAppHeader /> : null}
        <View style={{ flex: 1 }}>
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
            </Stack.Protected>
          </Stack>
        </View>
      </View>
    </ThemeProvider>
  );
}
