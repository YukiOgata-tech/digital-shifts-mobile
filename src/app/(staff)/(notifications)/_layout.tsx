import { Stack } from 'expo-router';

import { useAppTheme } from '@/constants/app-theme';

export default function NotificationsLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: '通知' }} />
    </Stack>
  );
}
