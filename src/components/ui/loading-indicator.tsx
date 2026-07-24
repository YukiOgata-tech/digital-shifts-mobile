import { ActivityIndicator, Text, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';

type Props = {
  label?: string;
  size?: 'small' | 'large';
  inverse?: boolean;
  compact?: boolean;
};

export function LoadingIndicator({
  label,
  size = 'small',
  inverse = false,
  compact = false,
}: Props) {
  const theme = useAppTheme();
  const color = inverse ? '#FFFFFF' : theme.brand;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? '処理中'}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? appSpacing.sm : appSpacing.md,
      }}>
      <View
        style={{
          width: size === 'large' ? 54 : 28,
          height: size === 'large' ? 54 : 28,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: appRadii.pill,
          backgroundColor: inverse ? 'rgba(255,255,255,0.12)' : theme.brandSoft,
        }}>
        <ActivityIndicator color={color} size={size} />
      </View>
      {label ? (
        <Text
          selectable
          style={{
            color: inverse ? '#FFFFFF' : theme.textSecondary,
            fontSize: compact ? 13 : 14,
            fontWeight: '700',
            textAlign: 'center',
          }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
