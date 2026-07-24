import { Button, Host } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAppTheme } from '@/constants/app-theme';

type NativeActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text';
  tone?: 'brand' | 'dark' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  haptic?: 'selection' | 'success';
};

export function NativeActionButton({
  label,
  onPress,
  variant = 'filled',
  tone = 'brand',
  disabled = false,
  loading = false,
  loadingLabel,
  haptic = 'selection',
}: NativeActionButtonProps) {
  const theme = useAppTheme();
  const seedColor =
    tone === 'dark' ? theme.hero : tone === 'danger' ? theme.danger : theme.brand;

  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      if (haptic === 'success') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.selectionAsync();
      }
    }
    onPress();
  };

  return (
    <View
      accessible={loading}
      accessibilityRole={loading ? 'progressbar' : undefined}
      accessibilityLabel={loading ? (loadingLabel ?? label) : undefined}
      accessibilityLiveRegion={loading ? 'polite' : 'none'}
      style={{ position: 'relative', minHeight: 48 }}>
      <View
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
        <Host matchContents seedColor={seedColor} style={{ minHeight: 48 }}>
          <Button
            disabled={disabled || loading}
            label={loading ? ' ' : label}
            onPress={handlePress}
            variant={variant}
          />
        </Host>
      </View>
      {loading ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <ActivityIndicator
            color={variant === 'filled' ? '#FFFFFF' : seedColor}
            size="small"
          />
          <Text
            numberOfLines={1}
            style={{
              color: variant === 'filled' ? '#FFFFFF' : seedColor,
              fontSize: 14,
              fontWeight: '800',
            }}>
            {loadingLabel ?? label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
