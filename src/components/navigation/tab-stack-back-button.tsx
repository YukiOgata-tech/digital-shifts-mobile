import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import { appSpacing, useAppTheme } from '@/constants/app-theme';

type TabStackBackButtonProps = {
  fallback:
    | '/(staff)/(home)'
    | '/(staff)/(shifts)'
    | '/(staff)/(attendance)'
    | '/(staff)/(notifications)'
    | '/(staff)/(settings)';
  label: string;
};

export function TabStackBackButton({ fallback, label }: TabStackBackButtonProps) {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}へ戻る`}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(fallback);
        }
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.xs,
        opacity: pressed ? 0.55 : 1,
      })}>
      {process.env.EXPO_OS === 'ios' ? (
        <SymbolView
          name="chevron.left"
          tintColor={theme.brandStrong}
          style={{ width: 16, height: 18 }}
        />
      ) : (
        <Text style={{ color: theme.brandStrong, fontSize: 22 }}>‹</Text>
      )}
      <Text style={{ color: theme.brandStrong, fontSize: 14, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}
