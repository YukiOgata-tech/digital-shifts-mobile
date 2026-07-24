import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { PageIntro } from '@/components/ui/page-intro';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatDateTime } from '@/features/staff/date';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/staff/queries';

export function NotificationsScreen() {
  const theme = useAppTheme();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadCount = notifications.data?.filter((notice) => !notice.readAt).length ?? 0;

  if (notifications.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="通知を読み込んでいます…" />
      </AppScreen>
    );
  }

  if (notifications.isError) {
    return (
      <AppScreen>
        <ErrorState
          message={notifications.error.message}
          onRetry={() => void notifications.refetch()}
        />
      </AppScreen>
    );
  }

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onError: (error) => Alert.alert('既読にできませんでした', error.message),
    });
  };

  return (
    <AppScreen
      contentContainerStyle={{ paddingTop: appSpacing.xl }}
      refreshing={notifications.isFetching}
      onRefresh={() => void notifications.refetch()}>
      <PageIntro
        eyebrow="Notifications"
        title="通知"
        description="シフト公開、変更、ヘルプ募集などの更新を確認します。"
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
          新着順
        </Text>
        <StatusPill
          label={unreadCount ? `未読 ${unreadCount}件` : 'すべて既読'}
          tone={unreadCount ? 'danger' : 'neutral'}
        />
      </View>

      {unreadCount ? (
        <NativeActionButton
          label={markAll.isPending ? '処理中…' : 'すべて既読にする'}
          variant="text"
          disabled={markAll.isPending}
          onPress={handleMarkAll}
        />
      ) : null}

      <View style={{ gap: appSpacing.md }}>
        {notifications.data?.length ? (
          notifications.data.map((notice) => (
            <Pressable
              key={notice.id}
              accessibilityRole="button"
              onPress={() => {
                if (!notice.readAt) {
                  markRead.mutate(notice.id, {
                    onError: (error) => Alert.alert('既読にできませんでした', error.message),
                  });
                }
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <SectionCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
                  {!notice.readAt ? (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: theme.brand,
                      }}
                    />
                  ) : null}
                  <Text
                    selectable
                    style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '700' }}>
                    {notice.title}
                  </Text>
                  <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {formatDateTime(notice.createdAt)}
                  </Text>
                </View>
                {notice.body ? (
                  <Text
                    selectable
                    style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 21 }}>
                    {notice.body}
                  </Text>
                ) : null}
              </SectionCard>
            </Pressable>
          ))
        ) : (
          <EmptyState title="通知はありません" />
        )}
      </View>
    </AppScreen>
  );
}
