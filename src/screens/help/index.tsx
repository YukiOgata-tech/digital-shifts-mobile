import { Alert, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatDateLabel, formatTime } from '@/features/staff/date';
import { useApplyToHelpRequest, useHelpRequests } from '@/features/staff/queries';

export function HelpScreen() {
  const theme = useAppTheme();
  const requests = useHelpRequests();
  const apply = useApplyToHelpRequest();

  if (requests.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="ヘルプ募集を読み込んでいます…" />
      </AppScreen>
    );
  }

  if (requests.isError) {
    return (
      <AppScreen>
        <ErrorState message={requests.error.message} onRetry={() => void requests.refetch()} />
      </AppScreen>
    );
  }

  const confirmApply = (requestId: string, title: string) => {
    Alert.alert('ヘルプに応募しますか？', title, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '応募する',
        onPress: () =>
          apply.mutate(
            { requestId },
            {
              onSuccess: () => Alert.alert('応募しました', '管理者の承認をお待ちください。'),
              onError: (error) => Alert.alert('応募できませんでした', error.message),
            },
          ),
      },
    ]);
  };

  return (
    <AppScreen refreshing={requests.isFetching} onRefresh={() => void requests.refetch()}>
      <TabStackBackButton fallback="/(staff)/(home)" label="ホーム" />
      {requests.data?.length ? (
        requests.data.map((request) => (
          <SectionCard key={request.id} tone={request.applicationId ? 'brand' : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: appSpacing.md }}>
              <View style={{ flex: 1, gap: appSpacing.xs }}>
                <Text
                  selectable
                  style={{ color: theme.brandStrong, fontSize: 13, fontWeight: '700' }}>
                  {request.storeName}
                </Text>
                <Text selectable style={{ color: theme.text, fontSize: 19, fontWeight: '700' }}>
                  {request.title}
                </Text>
              </View>
              <StatusPill
                label={request.applicationId ? '応募済み' : '募集中'}
                tone={request.applicationId ? 'brand' : 'info'}
              />
            </View>

            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: 17,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}>
              {formatDateLabel(`${request.workDate}T00:00:00+09:00`)}{' '}
              {formatTime(request.startAt)}–{formatTime(request.endAt)}
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              募集人数 {request.requiredCount}名
            </Text>
            {request.description ? (
              <Text selectable style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 21 }}>
                {request.description}
              </Text>
            ) : null}

            {request.applicationId ? (
              <Text selectable style={{ color: theme.brandStrong, fontSize: 14, fontWeight: '600' }}>
                状態: {request.applicationStatus === 'pending' ? '承認待ち' : request.applicationStatus}
              </Text>
            ) : (
              <NativeActionButton
                label={apply.isPending ? '応募中…' : 'この募集に応募する'}
                haptic="success"
                disabled={apply.isPending}
                onPress={() => confirmApply(request.id, request.title)}
              />
            )}
          </SectionCard>
        ))
      ) : (
        <EmptyState
          title="現在募集中のヘルプはありません"
          description="所属店舗で新しい募集が作成されると、ここに表示されます。"
        />
      )}
    </AppScreen>
  );
}
