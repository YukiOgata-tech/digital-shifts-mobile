import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { RefreshControl, ScrollView } from 'react-native';

import { appSpacing, useAppTheme } from '@/constants/app-theme';

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function AppScreen({
  children,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
}: AppScreenProps) {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
          />
        ) : undefined
      }
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[
        {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: appSpacing.md,
          paddingVertical: appSpacing.md,
          gap: appSpacing.md,
        },
        contentContainerStyle,
      ]}>
      {children}
    </ScrollView>
  );
}
