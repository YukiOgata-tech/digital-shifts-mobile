import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  formatDateLabel,
  formatDateTime,
  formatTime,
  greetingForNow,
  toDateKey,
} from '@/features/staff/date';
import {
  useAssignments,
  useNotifications,
  useOpenShiftPeriods,
  useStaffIdentity,
} from '@/features/staff/queries';

export function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const assignments = useAssignments(1, 31);
  const periods = useOpenShiftPeriods();
  const notifications = useNotifications();
  const todayKey = toDateKey(new Date());
  const todayShift = assignments.data?.find((shift) => shift.workDate === todayKey);
  const upcoming = assignments.data?.filter((shift) => shift.workDate >= todayKey).slice(0, 2) ?? [];
  const openPeriod = periods.data?.[0];
  const firstNotice = notifications.data?.[0];
  const isRefreshing =
    staff.isLoading || assignments.isFetching || periods.isFetching || notifications.isFetching;

  const refresh = () => {
    void Promise.all([
      staff.refresh(),
      assignments.refetch(),
      periods.refetch(),
      notifications.refetch(),
    ]);
  };

  if (staff.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="所属情報を読み込んでいます…" />
      </AppScreen>
    );
  }

  if (staff.error) {
    return (
      <AppScreen>
        <ErrorState message={staff.error.message} onRetry={refresh} />
      </AppScreen>
    );
  }

  if (!staff.activeTenant) {
    return (
      <AppScreen>
        <EmptyState
          title="利用できる所属がありません"
          description="有効なテナント所属が見つかりません。管理者に招待・所属状態を確認してもらってください。"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={refresh}>
      <View style={{ gap: appSpacing.sm }}>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 15 }}>
          {staff.activeStore?.name ?? staff.activeTenant.name}
        </Text>
        <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
          {greetingForNow()}、{staff.profile?.displayName ?? 'スタッフ'}さん
        </Text>
      </View>

      <SectionCard tone="brand">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: appSpacing.md,
          }}>
          <View style={{ flex: 1, gap: appSpacing.xs }}>
            <Text selectable style={{ color: theme.brandStrong, fontSize: 13, fontWeight: '700' }}>
              今日の勤務
            </Text>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: todayShift ? 32 : 20,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}>
              {todayShift
                ? `${formatTime(todayShift.startAt)}–${formatTime(todayShift.endAt)}`
                : '予定はありません'}
            </Text>
          </View>
          <StatusPill label={todayShift ? '確定' : '休日'} tone={todayShift ? 'brand' : 'neutral'} />
        </View>

        {todayShift ? (
          <View style={{ flexDirection: 'row', gap: appSpacing.lg }}>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              {todayShift.roleLabel ?? todayShift.storeName}
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              休憩 {todayShift.breakMinutes}分
            </Text>
          </View>
        ) : null}

        <NativeActionButton
          label="打刻画面を開く"
          disabled={!staff.activeStore}
          onPress={() => router.push('/(staff)/(attendance)')}
        />
      </SectionCard>

      {openPeriod ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push(
              { pathname: '/shift-request', params: { periodId: openPeriod.id } } as never,
            )
          }
          style={({ pressed }) => ({
            padding: appSpacing.lg,
            gap: appSpacing.sm,
            backgroundColor: theme.warningSoft,
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            opacity: pressed ? 0.75 : 1,
          })}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <StatusPill
              label={openPeriod.submittedAt ? '提出済み' : '提出期限'}
              tone={openPeriod.submittedAt ? 'brand' : 'warning'}
            />
            <Text selectable style={{ color: theme.warning, fontWeight: '700' }}>
              {formatDateTime(openPeriod.requestDeadlineAt)}
            </Text>
          </View>
          <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>
            {openPeriod.name}
          </Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
            希望入力 {openPeriod.entries.length}件
          </Text>
        </Pressable>
      ) : null}

      <View style={{ gap: appSpacing.md }}>
        <SectionHeading
          title="直近のシフト"
          action="すべて見る"
          onActionPress={() => router.push('/(staff)/(shifts)')}
        />
        {assignments.isError ? (
          <ErrorState message={assignments.error.message} onRetry={() => void assignments.refetch()} />
        ) : upcoming.length ? (
          upcoming.map((item) => (
            <SectionCard key={item.id} style={{ paddingVertical: appSpacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.lg }}>
                <View style={{ width: 86, gap: 2 }}>
                  <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                    {formatDateLabel(`${item.workDate}T00:00:00+09:00`)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    selectable
                    style={{
                      color: theme.text,
                      fontSize: 18,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}>
                    {formatTime(item.startAt)}–{formatTime(item.endAt)}
                  </Text>
                  <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {item.roleLabel ? `${item.roleLabel} · ` : ''}
                    {item.storeName}
                  </Text>
                </View>
              </View>
            </SectionCard>
          ))
        ) : (
          <EmptyState title="今後の確定シフトはありません" />
        )}
      </View>

      <View style={{ gap: appSpacing.md }}>
        <SectionHeading
          title="お知らせ"
          action="通知を見る"
          onActionPress={() => router.push('/notifications')}
        />
        {firstNotice ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <SectionCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
                {!firstNotice.readAt ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.brand,
                    }}
                  />
                ) : null}
                <Text
                  selectable
                  style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '700' }}>
                  {firstNotice.title}
                </Text>
                <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {formatDateTime(firstNotice.createdAt)}
                </Text>
              </View>
              {firstNotice.body ? (
                <Text
                  selectable
                  style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
                  {firstNotice.body}
                </Text>
              ) : null}
            </SectionCard>
          </Pressable>
        ) : (
          <EmptyState title="新しいお知らせはありません" />
        )}
      </View>
    </AppScreen>
  );
}
