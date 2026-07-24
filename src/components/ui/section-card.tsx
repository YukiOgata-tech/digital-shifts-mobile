import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';

type SectionCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'brand' | 'warning';
}>;

export function SectionCard({ children, style, tone = 'default' }: SectionCardProps) {
  const theme = useAppTheme();
  const backgroundColor =
    tone === 'brand' ? theme.brandSoft : tone === 'warning' ? theme.warningSoft : theme.surface;

  return (
    <View
      style={[
        {
          padding: appSpacing.lg,
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          backgroundColor,
          borderWidth: 1,
          borderColor:
            tone === 'brand'
              ? theme.brandSoft
              : tone === 'warning'
                ? theme.warningSoft
                : theme.border,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
        },
        style,
      ]}>
      {children}
    </View>
  );
}
