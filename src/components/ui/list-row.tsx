import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
}: ListRowProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        paddingHorizontal: appSpacing.lg,
        paddingVertical: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
      })}>
      {leading}
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        onPress ? <Text style={{ color: theme.textSecondary, fontSize: 24 }}>›</Text> : null
      )}
    </Pressable>
  );
}
