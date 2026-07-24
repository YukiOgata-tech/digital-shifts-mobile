import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { appSpacing, useAppTheme } from '@/constants/app-theme';

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

export function PageIntro({ eyebrow, title, description, trailing }: PageIntroProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        paddingHorizontal: appSpacing.xs,
        paddingBottom: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: appSpacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderSoft,
      }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          selectable
          style={{
            color: theme.brandStrong,
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
            color: theme.text,
            fontSize: 25,
            fontWeight: '900',
            letterSpacing: -0.5,
          }}>
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
