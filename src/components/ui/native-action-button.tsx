import { Button, Host } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { View } from 'react-native';

import { useAppTheme } from '@/constants/app-theme';

type NativeActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text';
  tone?: 'brand' | 'dark' | 'danger';
  disabled?: boolean;
  haptic?: 'selection' | 'success';
};

export function NativeActionButton({
  label,
  onPress,
  variant = 'filled',
  tone = 'brand',
  disabled = false,
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
    <View style={{ minHeight: 48 }}>
      <Host matchContents seedColor={seedColor} style={{ minHeight: 48 }}>
        <Button
          disabled={disabled}
          label={label}
          onPress={handlePress}
          variant={variant}
        />
      </Host>
    </View>
  );
}
