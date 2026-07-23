import { Text, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';

type StatusPillProps = {
  label: string;
  tone?: 'brand' | 'warning' | 'danger' | 'info' | 'neutral';
};

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const theme = useAppTheme();
  const colors = {
    brand: { background: theme.brandSoft, foreground: theme.brandStrong },
    warning: { background: theme.warningSoft, foreground: theme.warning },
    danger: { background: theme.dangerSoft, foreground: theme.danger },
    info: { background: theme.infoSoft, foreground: theme.info },
    neutral: { background: theme.surfaceMuted, foreground: theme.textSecondary },
  }[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: appSpacing.md,
        paddingVertical: 6,
        borderRadius: appRadii.pill,
        backgroundColor: colors.background,
      }}>
      <Text selectable style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
