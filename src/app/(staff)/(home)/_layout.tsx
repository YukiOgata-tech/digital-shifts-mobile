import Stack from 'expo-router/stack';

import { useAppTheme } from '@/constants/app-theme';

export default function HomeLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'ホーム' }} />
      <Stack.Screen name="help" options={{ title: 'ヘルプ募集' }} />
      <Stack.Screen name="stores" options={{ title: '所属店舗' }} />
    </Stack>
  );
}
