import { ActivityIndicator, Text, View } from 'react-native';

import { appSpacing, useAppTheme } from '@/constants/app-theme';

import { NativeActionButton } from './native-action-button';
import { SectionCard } from './section-card';

export function LoadingState({ label = '読み込み中…' }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ alignItems: 'center', gap: appSpacing.md, paddingVertical: appSpacing.xxl }}>
      <ActivityIndicator color={theme.brand} />
      <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  message = 'データを読み込めませんでした。',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <SectionCard tone="warning">
      <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
        読み込みエラー
      </Text>
      <Text selectable style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
        {message}
      </Text>
      {onRetry ? <NativeActionButton label="再読み込み" variant="outlined" onPress={onRetry} /> : null}
    </SectionCard>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const theme = useAppTheme();
  return (
    <SectionCard>
      <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
        {title}
      </Text>
      {description ? (
        <Text selectable style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
          {description}
        </Text>
      ) : null}
    </SectionCard>
  );
}
