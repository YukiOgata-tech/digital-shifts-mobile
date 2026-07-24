import Stack from 'expo-router/stack';

import { useAppTheme } from '@/constants/app-theme';

export default function AttendanceLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: '打刻' }} />
      <Stack.Screen name="attendance/[storeId]" options={{ title: '店舗別打刻' }} />
      <Stack.Screen name="attendance/records" options={{ title: '過去の打刻記録' }} />
      <Stack.Screen name="attendance-adjustment" options={{ title: '勤怠の後から入力' }} />
    </Stack>
  );
}
