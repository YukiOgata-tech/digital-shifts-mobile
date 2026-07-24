import Stack from 'expo-router/stack';

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
      <Stack.Screen name="profile" options={{ title: 'プロフィールと設定' }} />
      <Stack.Screen name="settings/account" options={{ title: 'アカウント' }} />
      <Stack.Screen name="settings/notifications" options={{ title: '通知設定' }} />
      <Stack.Screen name="settings/preferences" options={{ title: '操作・データ設定' }} />
    </Stack>
  );
}
