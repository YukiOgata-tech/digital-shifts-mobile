import { Text, View } from 'react-native';

import { appSpacing, useAppTheme } from '@/constants/app-theme';

import { LoadingIndicator } from './loading-indicator';
import { NativeActionButton } from './native-action-button';
import { SectionCard } from './section-card';

export function LoadingState({ label = '読み込み中…' }: { label?: string }) {
  return (
    <View
      style={{
        minHeight: 168,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: appSpacing.xxl,
      }}>
      <LoadingIndicator label={label} size="large" />
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
