import { Text, View } from 'react-native';

import { useAppTheme } from '@/constants/app-theme';

type SectionHeadingProps = {
  title: string;
  action?: string;
  onActionPress?: () => void;
};

export function SectionHeading({ title, action, onActionPress }: SectionHeadingProps) {
  const theme = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text selectable style={{ color: theme.text, fontSize: 19, fontWeight: '700' }}>
        {title}
      </Text>
      {action ? (
        <Text
          accessibilityRole={onActionPress ? 'button' : undefined}
          onPress={onActionPress}
          style={{ color: theme.brand, fontSize: 14, fontWeight: '700' }}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}
