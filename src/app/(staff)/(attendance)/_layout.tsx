import { Stack } from 'expo-router';

import { useAppTheme } from '@/constants/app-theme';

export default function AttendanceLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeStyle: { backgroundColor: theme.background },
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: '打刻' }} />
    </Stack>
  );
}
