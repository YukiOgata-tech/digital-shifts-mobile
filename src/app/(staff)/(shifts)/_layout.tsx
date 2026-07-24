import Stack from 'expo-router/stack';

import { useAppTheme } from '@/constants/app-theme';

export default function ShiftsLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'シフト' }} />
      <Stack.Screen name="shift-request" options={{ title: '希望シフト入力' }} />
      <Stack.Screen name="shift-adjustment" options={{ title: 'シフト修正希望' }} />
      <Stack.Screen name="store-schedule" options={{ title: '全員のシフト表' }} />
    </Stack>
  );
}
