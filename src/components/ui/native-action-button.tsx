import { Button, Host } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { View } from 'react-native';

import { useAppTheme } from '@/constants/app-theme';

type NativeActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text';
  disabled?: boolean;
  haptic?: 'selection' | 'success';
};

export function NativeActionButton({
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  haptic = 'selection',
}: NativeActionButtonProps) {
  const theme = useAppTheme();

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
      <Host matchContents seedColor={theme.brand} style={{ minHeight: 48 }}>
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
