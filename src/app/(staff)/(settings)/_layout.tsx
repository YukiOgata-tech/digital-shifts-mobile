import { Stack } from 'expo-router';

import { useAppTheme } from '@/constants/app-theme';

export default function SettingsLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: '設定' }} />
    </Stack>
  );
}
