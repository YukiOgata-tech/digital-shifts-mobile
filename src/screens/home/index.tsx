import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { StaffHeroCard } from '@/components/ui/staff-hero-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  formatDateLabel,
  formatDateTime,
  formatTime,
  toDateKey,
} from '@/features/staff/date';
import {
  useActiveAttendanceRecord,
  useAssignments,
  useNotifications,
  useOpenShiftPeriods,
  useStaffIdentity,
} from '@/features/staff/queries';

export function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const attendance = useActiveAttendanceRecord();
  const assignments = useAssignments(1, 31);
  const periods = useOpenShiftPeriods();
  const notifications = useNotifications();
  const todayKey = toDateKey(new Date());
  const todayShift = assignments.data?.find((shift) => shift.workDate === todayKey);
  const upcoming = assignments.data?.filter((shift) => shift.workDate >= todayKey).slice(0, 2) ?? [];
  const openPeriod = periods.data?.[0];
  const firstNotice = notifications.data?.[0];
  const isWorking = attendance.data?.status === 'open';
  const isRefreshing =
    staff.isLoading ||
    assignments.isFetching ||
    periods.isFetching ||
    notifications.isFetching ||
    attendance.isFetching;

  const refresh = () => {
    void Promise.all([
      staff.refresh(),
      assignments.refetch(),
      periods.refetch(),
      notifications.refetch(),
      attendance.refetch(),
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
      <StaffHeroCard
        eyebrow="Staff home"
        title="今日の勤務"
        trailing={
          <View
            style={{
              paddingHorizontal: appSpacing.md,
              paddingVertical: 6,
              borderRadius: appRadii.pill,
              backgroundColor: isWorking ? theme.danger : theme.brandBright,
            }}>
            <Text
              style={{
                color: isWorking ? '#FFFFFF' : theme.hero,
                fontSize: 11,
                fontWeight: '900',
              }}>
              {isWorking ? '勤務中' : '待機中'}
            </Text>
          </View>
        }>
        <View
          style={{
            padding: appSpacing.lg,
            gap: appSpacing.md,
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.09)',
          }}>
          {todayShift ? (
            <View style={{ gap: appSpacing.sm }}>
            <Text
              selectable
              style={{
                  color: theme.heroText,
                  fontSize: 36,
                  fontWeight: '900',
                  letterSpacing: -1.2,
                fontVariant: ['tabular-nums'],
              }}>
                {formatTime(todayShift.startAt)}
                <Text style={{ color: 'rgba(255,255,255,0.42)', fontSize: 25 }}> - </Text>
                {formatTime(todayShift.endAt)}
            </Text>
              <Text selectable style={{ color: theme.heroMuted, fontSize: 13, fontWeight: '700' }}>
                {todayShift.storeName}
                {todayShift.roleLabel ? ` · ${todayShift.roleLabel}` : ''}
                {` · 休憩 ${todayShift.breakMinutes}分`}
              </Text>
          </View>
          ) : (
            <View style={{ gap: appSpacing.xs }}>
              <Text
                selectable
                style={{ color: theme.heroText, fontSize: 19, fontWeight: '900' }}>
                本日の公開シフトはありません
              </Text>
              <Text selectable style={{ color: theme.heroMuted, fontSize: 13 }}>
                必要な場合は店舗を選んで打刻できます。
              </Text>
            </View>
          )}
          <NativeActionButton
            label={isWorking ? '退勤画面を開く' : todayShift ? '出勤する' : '打刻画面へ'}
            disabled={!staff.activeStore}
            haptic="success"
            onPress={() => router.push('/(staff)/(attendance)')}
          />
        </View>
      </StaffHeroCard>

      <View style={{ gap: 4, paddingHorizontal: appSpacing.xs }}>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
          {staff.activeStore?.name ?? staff.activeTenant.name}
        </Text>
        <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>
          {staff.profile?.displayName ?? 'スタッフ'}さん
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
        <QuickAction
          label="希望提出"
          detail={openPeriod?.submittedAt ? '完了' : openPeriod ? '要対応' : 'なし'}
          tone="warning"
          onPress={() => {
            if (openPeriod) {
              router.push(
                { pathname: '/shift-request', params: { periodId: openPeriod.id } } as never,
              );
            } else {
              router.push('/(staff)/(stores)');
            }
          }}
        />
        <QuickAction
          label="シフト"
          detail="確認"
          tone="brand"
          onPress={() => router.push('/(staff)/(shifts)')}
        />
        <QuickAction
          label="打刻"
          detail={isWorking ? '勤務中' : '履歴'}
          tone="neutral"
          onPress={() => router.push('/(staff)/(attendance)')}
        />
      </View>

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
            borderWidth: 1,
            borderColor: '#FCD34D',
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
          <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>
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
                  <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>
                    {formatDateLabel(`${item.workDate}T00:00:00+09:00`)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    selectable
                    style={{
                      color: theme.text,
                      fontSize: 18,
                      fontWeight: '900',
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
          onActionPress={() => router.push('/(staff)/(notifications)')}
        />
        {firstNotice ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(staff)/(notifications)')}
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

function QuickAction({
  label,
  detail,
  tone,
  onPress,
}: {
  label: string;
  detail: string;
  tone: 'brand' | 'warning' | 'neutral';
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const colors = {
    brand: { background: theme.brandSoft, foreground: theme.brandStrong, border: '#A7F3D0' },
    warning: { background: theme.warningSoft, foreground: theme.warning, border: '#FDE68A' },
    neutral: {
      background: theme.surface,
      foreground: theme.text,
      border: theme.border,
    },
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 82,
        justifyContent: 'space-between',
        padding: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        opacity: pressed ? 0.7 : 1,
        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.07)',
      })}>
      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '900' }}>{detail}</Text>
    </Pressable>
  );
}
