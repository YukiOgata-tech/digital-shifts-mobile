import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  formatDateLabel,
  formatDateTime,
  formatTime,
  toDateKey,
} from '@/features/staff/date';
import {
  useAssignments,
  useAttendanceStoreStatuses,
  useOpenShiftPeriods,
  useShiftAdjustmentWindows,
  useStaffIdentity,
} from '@/features/staff/queries';
import type {
  OpenShiftPeriod,
  ShiftAdjustmentWindow,
  ShiftAssignment,
} from '@/features/staff/types';

export function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const assignments = useAssignments(1, 62, true);
  const periods = useOpenShiftPeriods(true);
  const adjustments = useShiftAdjustmentWindows(true);
  const attendanceStatuses = useAttendanceStoreStatuses();
  const todayKey = toDateKey(new Date());

  const activeAttendance =
    attendanceStatuses.data?.find((status) => status.record)?.record ?? null;
  const todayAssignments =
    assignments.data?.filter((assignment) => assignment.workDate === todayKey) ?? [];
  const todayShift =
    todayAssignments.find((assignment) => assignment.storeId === activeAttendance?.storeId) ??
    todayAssignments[0] ??
    null;
  const nextShift =
    assignments.data?.find(
      (assignment) =>
        assignment.workDate >= todayKey && assignment.id !== todayShift?.id,
    ) ?? null;
  const unsubmittedPeriods =
    periods.data?.filter((period) => !period.submittedAt) ?? [];
  const openAdjustments =
    adjustments.data?.filter((window) => window.status === 'open') ?? [];
  const actionCount = unsubmittedPeriods.length + openAdjustments.length;
  const attendanceStoreId =
    activeAttendance?.storeId ??
    todayShift?.storeId ??
    (staff.stores.length === 1 ? staff.stores[0]?.id : undefined);
  const isRefreshing =
    staff.isLoading ||
    assignments.isFetching ||
    periods.isFetching ||
    adjustments.isFetching ||
    attendanceStatuses.isFetching;
  const isLoadingHome =
    assignments.isLoading ||
    periods.isLoading ||
    adjustments.isLoading ||
    attendanceStatuses.isLoading;
  const queryError =
    assignments.error ??
    periods.error ??
    adjustments.error ??
    attendanceStatuses.error;

  const refresh = () => {
    void Promise.all([
      staff.refresh(),
      assignments.refetch(),
      periods.refetch(),
      adjustments.refetch(),
      attendanceStatuses.refetch(),
    ]);
  };

  const openAttendance = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (attendanceStoreId) {
      router.push(`/attendance/${attendanceStoreId}` as never);
      return;
    }
    router.push('/(staff)/(attendance)');
  };

  const openPrimaryRequest = () => {
    const window = openAdjustments[0];
    if (window) {
      router.push({
        pathname: '/shift-adjustment',
        params: { windowId: window.id },
      } as never);
      return;
    }
    const period = unsubmittedPeriods[0];
    if (period) {
      router.push({
        pathname: '/shift-request',
        params: { periodId: period.id },
      } as never);
      return;
    }
    router.push('/(staff)/(shifts)');
  };

  if (staff.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="ホーム情報を読み込んでいます…" />
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

  if (isLoadingHome) {
    return (
      <AppScreen>
        <LoadingState label="今日の勤務と予定を読み込んでいます…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      refreshing={isRefreshing}
      onRefresh={refresh}
      contentContainerStyle={{ paddingTop: appSpacing.sm, paddingBottom: appSpacing.xxl }}>
      <View style={{ alignItems: 'flex-end' }}>
        <RefreshButton refreshing={isRefreshing} onPress={refresh} />
      </View>

      {queryError ? (
        <ErrorState
          message={queryError.message}
          onRetry={refresh}
        />
      ) : null}

      <TodayCard
        shift={todayShift}
        activeStoreName={
          activeAttendance
            ? staff.stores.find((store) => store.id === activeAttendance.storeId)?.name
            : undefined
        }
        isWorking={Boolean(activeAttendance)}
        attendanceDisabled={!staff.stores.length}
        onAttendancePress={openAttendance}
      />

      <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
        <QuickAction
          symbol="doc.badge.plus"
          label="希望提出"
          detail={actionCount ? `${actionCount}件` : '完了'}
          tone={openAdjustments.length ? 'info' : 'warning'}
          onPress={openPrimaryRequest}
        />
        <QuickAction
          symbol="calendar.badge.checkmark"
          label="シフト"
          detail="確認"
          tone="brand"
          onPress={() => router.navigate('/(staff)/(shifts)')}
        />
        <QuickAction
          symbol="clock.arrow.circlepath"
          label="打刻履歴"
          detail="記録"
          tone="neutral"
          onPress={() => router.push('/attendance/records')}
        />
      </View>

      <HomeCard>
        <SectionTitle
          eyebrow="Need action"
          title="未提出の希望"
          count={actionCount}
          tone={openAdjustments.length ? 'info' : 'warning'}
        />
        <View style={{ gap: appSpacing.sm }}>
          {openAdjustments.slice(0, 4).map((window) => (
            <AdjustmentRequestRow
              key={window.id}
              window={window}
              onPress={() =>
                router.push({
                  pathname: '/shift-adjustment',
                  params: { windowId: window.id },
                } as never)
              }
            />
          ))}
          {unsubmittedPeriods
            .slice(0, Math.max(0, 4 - openAdjustments.length))
            .map((period) => (
              <PeriodRequestRow
                key={period.id}
                period={period}
                onPress={() =>
                  router.push({
                    pathname: '/shift-request',
                    params: { periodId: period.id },
                  } as never)
                }
              />
            ))}
          {!actionCount ? (
            <View
              style={{
                minHeight: 58,
                justifyContent: 'center',
                padding: appSpacing.md,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                backgroundColor: theme.brandSoft,
              }}>
              <Text
                selectable
                style={{ color: theme.brandStrong, fontSize: 13, fontWeight: '800' }}>
                現在、未提出の希望シフトはありません。
              </Text>
            </View>
          ) : null}
        </View>
      </HomeCard>

      <HomeCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text
            accessibilityRole="header"
            selectable
            style={{ color: theme.text, fontSize: 19, fontWeight: '900' }}>
            次の勤務
          </Text>
          <AppSymbol name="calendar.badge.clock" color={theme.brandStrong} size={21} fallback="▣" />
        </View>
        {nextShift ? (
          <NextShift shift={nextShift} />
        ) : (
          <View
            style={{
              padding: appSpacing.md,
              borderRadius: appRadii.md,
              borderCurve: 'continuous',
              backgroundColor: theme.surfaceMuted,
            }}>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>
              今後の公開シフトはまだありません。
            </Text>
          </View>
        )}
      </HomeCard>

      <HomeCard>
        <Text
          accessibilityRole="header"
          selectable
          style={{ color: theme.text, fontSize: 19, fontWeight: '900' }}>
          その他
        </Text>
        <View style={{ gap: appSpacing.sm }}>
          <ListLink
            symbol="bell"
            label="通知を確認"
            onPress={() => router.navigate('/(staff)/(notifications)')}
          />
          <ListLink
            symbol="storefront"
            label="所属店舗を見る"
            onPress={() => router.push('/stores')}
          />
          <ListLink
            symbol="checklist"
            label="設定を開く"
            onPress={() => router.navigate('/(staff)/(settings)')}
          />
        </View>
      </HomeCard>
    </AppScreen>
  );
}

function TodayCard({
  shift,
  activeStoreName,
  isWorking,
  attendanceDisabled,
  onAttendancePress,
}: {
  shift: ShiftAssignment | null;
  activeStoreName?: string;
  isWorking: boolean;
  attendanceDisabled: boolean;
  onAttendancePress: () => void;
}) {
  const theme = useAppTheme();
  const attendanceLabel = isWorking
    ? '退勤画面へ'
    : shift
      ? '出勤する'
      : '打刻画面へ';

  return (
    <HomeCard>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: appSpacing.md,
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            selectable
            style={{
              color: theme.brandStrong,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.8,
              textTransform: 'uppercase',
            }}>
            Staff home
          </Text>
          <Text
            accessibilityRole="header"
            selectable
            style={{
              color: theme.text,
              fontSize: 25,
              fontWeight: '900',
              letterSpacing: -0.5,
            }}>
            今日の勤務
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: appSpacing.md,
            paddingVertical: 6,
            borderRadius: appRadii.pill,
            backgroundColor: isWorking ? theme.dangerSoft : theme.brandSoft,
          }}>
          <Text
            style={{
              color: isWorking ? theme.danger : theme.brandStrong,
              fontSize: 11,
              fontWeight: '900',
            }}>
            {isWorking ? '勤務中' : '待機中'}
          </Text>
        </View>
      </View>

      <View
        style={{
          padding: appSpacing.md,
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: theme.borderSoft,
          backgroundColor: theme.brandSoft,
        }}>
        {shift ? (
          <View style={{ gap: appSpacing.xs }}>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: 31,
                fontWeight: '900',
                letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}>
              {formatTime(shift.startAt)}
              <Text style={{ color: theme.textSecondary, fontSize: 23 }}> - </Text>
              {formatTime(shift.endAt)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppSymbol name="mappin.and.ellipse" color={theme.textSecondary} size={15} fallback="●" />
              <Text
                selectable
                style={{ flex: 1, color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>
                {shift.storeName}
                {shift.roleLabel ? ` · ${shift.roleLabel}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: appSpacing.xs }}>
            <Text
              selectable
              style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
              本日の公開シフトはありません
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
              {isWorking && activeStoreName
                ? `${activeStoreName}で勤務中です。`
                : '必要な場合は店舗を選んで打刻できます。'}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={attendanceLabel}
          accessibilityState={{ disabled: attendanceDisabled }}
          disabled={attendanceDisabled}
          onPress={onAttendancePress}
          style={({ pressed }) => ({
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: appSpacing.sm,
            borderRadius: appRadii.md,
            borderCurve: 'continuous',
            backgroundColor: isWorking ? theme.danger : theme.brand,
            opacity: attendanceDisabled ? 0.4 : pressed ? 0.72 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
            boxShadow: isWorking
              ? '0 8px 18px rgba(225, 29, 72, 0.18)'
              : '0 8px 18px rgba(5, 150, 105, 0.20)',
          })}>
          <AppSymbol name="clock" color="#FFFFFF" size={20} fallback="◷" />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>
            {attendanceLabel}
          </Text>
        </Pressable>
      </View>
    </HomeCard>
  );
}

function QuickAction({
  symbol,
  label,
  detail,
  tone,
  onPress,
}: {
  symbol: SFSymbol;
  label: string;
  detail: string;
  tone: 'brand' | 'warning' | 'info' | 'neutral';
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const colors = {
    brand: {
      background: theme.brandSoft,
      border: '#A7F3D0',
      foreground: theme.brandStrong,
    },
    warning: {
      background: '#FFFBEB',
      border: '#FDE68A',
      foreground: theme.warning,
    },
    info: {
      background: theme.infoSoft,
      border: '#BAE6FD',
      foreground: theme.info,
    },
    neutral: {
      background: theme.surface,
      border: theme.border,
      foreground: theme.text,
    },
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${detail}`}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 112,
        padding: appSpacing.sm,
        gap: 6,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        boxShadow: '0 5px 14px rgba(15, 23, 42, 0.09)',
      })}>
      <View
        style={{
          width: 38,
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 13,
          borderCurve: 'continuous',
          backgroundColor: theme.surface,
          boxShadow: '0 3px 8px rgba(15, 23, 42, 0.08)',
        }}>
        <AppSymbol name={symbol} color={colors.foreground} size={19} fallback="•" />
      </View>
      <Text
        numberOfLines={1}
        style={{ color: theme.text, fontSize: 14, fontWeight: '900' }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: colors.foreground,
          fontSize: 12,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}>
        {detail}
      </Text>
    </Pressable>
  );
}

function SectionTitle({
  eyebrow,
  title,
  count,
  tone,
}: {
  eyebrow: string;
  title: string;
  count: number;
  tone: 'warning' | 'info';
}) {
  const theme = useAppTheme();
  const foreground = tone === 'info' ? theme.info : theme.warning;
  const background = tone === 'info' ? theme.infoSoft : theme.warningSoft;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: appSpacing.md,
      }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          selectable
          style={{
            color: foreground,
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.6,
            textTransform: 'uppercase',
          }}>
          {eyebrow}
        </Text>
        <Text
          accessibilityRole="header"
          selectable
          style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>
          {title}
        </Text>
      </View>
      <View
        style={{
          minWidth: 42,
          alignItems: 'center',
          paddingHorizontal: appSpacing.md,
          paddingVertical: 6,
          borderRadius: appRadii.pill,
          backgroundColor: background,
        }}>
        <Text
          style={{
            color: foreground,
            fontSize: 11,
            fontWeight: '900',
            fontVariant: ['tabular-nums'],
          }}>
          {count}件
        </Text>
      </View>
    </View>
  );
}

function PeriodRequestRow({
  period,
  onPress,
}: {
  period: OpenShiftPeriod;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <RequestRow
      accessibilityLabel={`${period.name} ${period.storeName}の希望を入力`}
      background="#FFFBEB"
      border="#FDE68A"
      onPress={onPress}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
          {period.name}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
          {period.storeName}
        </Text>
        <Text selectable style={{ color: theme.warning, fontSize: 11, fontWeight: '900' }}>
          {formatDateRange(period.startDate, period.endDate)}
        </Text>
      </View>
      <AppSymbol name="chevron.right" color={theme.warning} size={16} fallback="›" />
    </RequestRow>
  );
}

function AdjustmentRequestRow({
  window,
  onPress,
}: {
  window: ShiftAdjustmentWindow;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <RequestRow
      accessibilityLabel={`${window.periodName} ${window.storeName}の修正希望を入力`}
      background={theme.infoSoft}
      border="#BAE6FD"
      onPress={onPress}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
          {window.periodName}
        </Text>
        <Text
          selectable
          numberOfLines={1}
          style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
          {window.storeName}
        </Text>
        <Text selectable style={{ color: theme.info, fontSize: 11, fontWeight: '900' }}>
          修正希望受付中
          {window.dueAt ? ` · 期限 ${formatDateTime(window.dueAt)}` : ''}
        </Text>
      </View>
      <AppSymbol name="chevron.right" color={theme.info} size={16} fallback="›" />
    </RequestRow>
  );
}

function RequestRow({
  accessibilityLabel,
  background,
  border,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  background: string;
  border: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 94,
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.md,
        padding: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: border,
        backgroundColor: background,
        opacity: pressed ? 0.7 : 1,
      })}>
      {children}
    </Pressable>
  );
}

function NextShift({ shift }: { shift: ShiftAssignment }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        padding: appSpacing.md,
        gap: 3,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: theme.surfaceMuted,
      }}>
      <Text selectable style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '900' }}>
        {formatDateLabel(`${shift.workDate}T00:00:00+09:00`)}
      </Text>
      <Text
        selectable
        style={{
          color: theme.text,
          fontSize: 26,
          fontWeight: '900',
          letterSpacing: -0.6,
          fontVariant: ['tabular-nums'],
        }}>
        {formatTime(shift.startAt)} - {formatTime(shift.endAt)}
      </Text>
      <Text selectable style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
        {shift.storeName}
      </Text>
    </View>
  );
}

function ListLink({
  symbol,
  label,
  onPress,
}: {
  symbol: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.md,
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: theme.surfaceMuted,
        opacity: pressed ? 0.66 : 1,
      })}>
      <View
        style={{
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: appRadii.sm,
          backgroundColor: theme.surface,
        }}>
        <AppSymbol name={symbol} color={theme.textSecondary} size={17} fallback="•" />
      </View>
      <Text style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
      <AppSymbol name="chevron.right" color={theme.textSecondary} size={15} fallback="›" />
    </Pressable>
  );
}

function RefreshButton({
  refreshing,
  onPress,
}: {
  refreshing: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="ホーム情報を更新"
      accessibilityState={{ busy: refreshing }}
      disabled={refreshing}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: appSpacing.sm,
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        opacity: refreshing ? 0.55 : pressed ? 0.7 : 1,
        boxShadow: '0 3px 9px rgba(15, 23, 42, 0.09)',
      })}>
      {refreshing ? (
        <ActivityIndicator color={theme.textSecondary} size="small" />
      ) : (
        <AppSymbol name="arrow.clockwise" color={theme.textSecondary} size={17} fallback="↻" />
      )}
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>更新</Text>
    </Pressable>
  );
}

function HomeCard({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        padding: appSpacing.md,
        gap: appSpacing.md,
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        boxShadow: '0 7px 20px rgba(15, 23, 42, 0.09)',
      }}>
      {children}
    </View>
  );
}

function AppSymbol({
  name,
  color,
  size,
  fallback,
}: {
  name: SFSymbol;
  color: string;
  size: number;
  fallback: string;
}) {
  if (process.env.EXPO_OS !== 'ios') {
    return <Text style={{ color, fontSize: size, fontWeight: '800' }}>{fallback}</Text>;
  }
  return (
    <SymbolView
      name={name}
      tintColor={color}
      weight="semibold"
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}

function formatDateRange(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = startYear === endYear ? `${startMonth}月${startDay}日` : `${startYear}年${startMonth}月${startDay}日`;
  const end = `${endMonth}月${endDay}日`;
  return `${start} - ${end}`;
}
