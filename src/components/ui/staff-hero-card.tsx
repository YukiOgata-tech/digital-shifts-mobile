import type { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';

type StaffHeroCardProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
}>;

export function StaffHeroCard({
  eyebrow,
  title,
  trailing,
  children,
}: StaffHeroCardProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        overflow: 'hidden',
        padding: appSpacing.lg,
        gap: appSpacing.lg,
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        backgroundColor: theme.hero,
        boxShadow: '0 14px 32px rgba(2, 6, 23, 0.24)',
      }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -76,
          top: -112,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: 'rgba(16, 185, 129, 0.24)',
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: appSpacing.md,
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            selectable
            style={{
              color: theme.brandBright,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.8,
              textTransform: 'uppercase',
            }}>
            {eyebrow}
          </Text>
          <Text
            selectable
            style={{
              color: theme.heroText,
              fontSize: 24,
              fontWeight: '900',
              letterSpacing: -0.5,
            }}>
            {title}
          </Text>
        </View>
        {trailing}
      </View>
      {children}
    </View>
  );
}
