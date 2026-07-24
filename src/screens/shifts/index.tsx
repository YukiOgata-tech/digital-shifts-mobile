import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { StaffMonthCalendar } from '@/components/shifts/staff-month-calendar';
import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState, LoadingState } from '@/components/ui/data-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatDateLabel, formatDateTime, formatTime, toDateKey } from '@/features/staff/date';
import {
  useAssignments,
  useAssignmentsForRange,
  useAttendanceRecords,
  useOpenShiftPeriods,
  usePublishedSchedulePeriods,
} from '@/features/staff/queries';
import type {
  OpenShiftPeriod,
  PublishedSchedulePeriod,
  ShiftAssignment,
} from '@/features/staff/types';

export function ShiftsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const today = toDateKey(new Date());
  const [yearMonth, setYearMonth] = useState(today.slice(0, 7));
  const monthRange = useMemo(() => getMonthRange(yearMonth), [yearMonth]);
  const periods = useOpenShiftPeriods(true);
  const upcomingAssignments = useAssignments(0, 365, true);
  const monthAssignments = useAssignmentsForRange(
    monthRange.startDate,
    monthRange.endDate,
    true,
  );
  const attendance = useAttendanceRecords(monthRange.startDate, monthRange.endDate);
  const publishedSchedules = usePublishedSchedulePeriods();
  const upcoming =
    upcomingAssignments.data?.filter((item) => item.workDate >= today) ?? [];
  const nextShift = upcoming[0];
  const upcomingMinutes = upcoming.reduce((total, item) => {
    const duration =
      (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000 -
      item.breakMinutes;
    return total + Math.max(0, duration);
  }, 0);
  const allSubmitted = Boolean(
    periods.data?.length && periods.data.every((period) => period.submittedAt),
  );
  const isRefreshing =
    periods.isFetching ||
    upcomingAssignments.isFetching ||
    monthAssignments.isFetching ||
    attendance.isFetching ||
    publishedSchedules.isFetching;

  const refresh = async () => {
    await Promise.all([
      periods.refetch(),
      upcomingAssignments.refetch(),
      monthAssignments.refetch(),
      attendance.refetch(),
      publishedSchedules.refetch(),
    ]);
  };

  return (
    <AppScreen refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <SectionCard style={{ overflow: 'hidden', padding: 0, gap: 0 }}>
        <View style={{ padding: appSpacing.lg, gap: appSpacing.md }}>
          <SectionLabel eyebrow="My schedule" title="シフト" />
          <View
            style={{
              padding: appSpacing.lg,
              gap: appSpacing.sm,
              borderRadius: appRadii.lg,
              borderCurve: 'continuous',
              backgroundColor: theme.brandSoft,
              borderWidth: 1,
              borderColor: theme.brandSoft,
            }}>
            <Text
              style={{
                color: theme.brandStrong,
                fontSize: 11,
                fontWeight: '900',
                letterSpacing: 0.5,
              }}>
              次の勤務
            </Text>
            {upcomingAssignments.isLoading ? (
              <LoadingState label="勤務を確認しています…" />
            ) : nextShift ? (
              <>
                <Text
                  selectable
                  style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>
                  {formatDateLabel(`${nextShift.workDate}T00:00:00+09:00`)}
                </Text>
                <Text
                  selectable
                  style={{
                    color: theme.text,
                    fontSize: 27,
                    fontWeight: '900',
                    fontVariant: ['tabular-nums'],
                  }}>
                  {formatTime(nextShift.startAt)}–{formatTime(nextShift.endAt)}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {nextShift.storeName}
                  {nextShift.roleLabel ? ` · ${nextShift.roleLabel}` : ''}
                </Text>
              </>
            ) : (
              <Text
                selectable
                style={{ color: theme.textSecondary, fontSize: 15, fontWeight: '800' }}>
                今後の確定シフトはまだありません。
              </Text>
            )}
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}>
          <Metric label="今後" value={`${upcoming.length}件`} />
          <Metric label="勤務時間" value={`${Math.round(upcomingMinutes / 60)}時間`} bordered />
          <Metric
            label="店舗"
            value={`${new Set(upcoming.map((item) => item.storeId)).size}店舗`}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: appSpacing.md,
          }}>
          <SectionLabel eyebrow="Requests" title="シフト希望の募集状況" />
          {periods.data?.length ? (
            <StatusPill
              label={allSubmitted ? 'すべて提出済み' : '未提出あり'}
              tone={allSubmitted ? 'brand' : 'warning'}
            />
          ) : null}
        </View>
        {periods.isLoading ? <LoadingState label="募集状況を読み込んでいます…" /> : null}
        {periods.error ? (
          <ErrorState message={periods.error.message} onRetry={() => void periods.refetch()} />
        ) : null}
        {!periods.isLoading && !periods.error && periods.data?.length ? (
          <View style={{ gap: appSpacing.sm }}>
            {periods.data.map((period) => (
              <RequestPeriodRow
                key={period.id}
                period={period}
                onPress={() =>
                  router.push(
                    { pathname: '/shift-request', params: { periodId: period.id } } as never,
                  )
                }
              />
            ))}
          </View>
        ) : null}
        {!periods.isLoading && !periods.error && !periods.data?.length ? (
          <SectionMessage
            title="受付中の募集はありません"
            description="募集が開始されると、ここから希望シフトを提出できます。"
          />
        ) : null}
      </SectionCard>

      <SectionCard>
        <SectionLabel eyebrow="Shift sheet" title="全員のシフト表（画像保存）" />
        <Text selectable style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 20 }}>
          公開されたシフト期間の全員分の表を、端末へ画像として保存・共有できます。
        </Text>
        {publishedSchedules.isLoading ? (
          <LoadingState label="公開シフト表を読み込んでいます…" />
        ) : null}
        {publishedSchedules.error ? (
          <ErrorState
            message={publishedSchedules.error.message}
            onRetry={() => void publishedSchedules.refetch()}
          />
        ) : null}
        {!publishedSchedules.isLoading &&
        !publishedSchedules.error &&
        publishedSchedules.data?.length ? (
          <View style={{ gap: appSpacing.sm }}>
            {publishedSchedules.data.map((schedule) => (
              <PublishedScheduleRow
                key={schedule.id}
                schedule={schedule}
                onPress={() =>
                  router.push({
                    pathname: '/store-schedule',
                    params: {
                      storeId: schedule.storeId,
                      storeName: schedule.storeName,
                      yearMonth: schedule.yearMonth,
                      periodName: schedule.name,
                    },
                  } as never)
                }
              />
            ))}
          </View>
        ) : null}
        {!publishedSchedules.isLoading &&
        !publishedSchedules.error &&
        !publishedSchedules.data?.length ? (
          <SectionMessage
            title="公開済みのシフト表はありません"
            description="管理者がシフトを公開すると、ここに画像保存ボタンが表示されます。"
          />
        ) : null}
      </SectionCard>

      {monthAssignments.error || attendance.error ? (
        <ErrorState
          message={monthAssignments.error?.message ?? attendance.error?.message}
          onRetry={() => {
            void monthAssignments.refetch();
            void attendance.refetch();
          }}
        />
      ) : (
        <StaffMonthCalendar
          yearMonth={yearMonth}
          assignments={monthAssignments.data ?? []}
          attendanceRecords={attendance.data ?? []}
          onMonthChange={setYearMonth}
        />
      )}

      <View style={{ gap: appSpacing.md }}>
        <View
          style={{
            paddingHorizontal: appSpacing.xs,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>
            今後の勤務
          </Text>
          <Text
            accessibilityRole="button"
            onPress={() => router.push('/stores')}
            style={{ color: theme.brandStrong, fontSize: 14, fontWeight: '900' }}>
            店舗一覧
          </Text>
        </View>
        {upcomingAssignments.error ? (
          <ErrorState
            message={upcomingAssignments.error.message}
            onRetry={() => void upcomingAssignments.refetch()}
          />
        ) : upcoming.length ? (
          upcoming.slice(0, 24).map((assignment) => (
            <UpcomingShiftRow key={assignment.id} assignment={assignment} />
          ))
        ) : (
          <SectionMessage
            title="公開済みシフトはありません"
            description="管理者がシフトを公開後、ここに表示されます。"
          />
        )}
      </View>
    </AppScreen>
  );
}

function RequestPeriodRow({
  period,
  onPress,
}: {
  period: OpenShiftPeriod;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 92,
        padding: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: pressed ? theme.brandSoft : theme.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.borderSoft,
      })}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>
          {period.name}
        </Text>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>
          {period.storeName}
        </Text>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
          {formatDateRange(period.startDate, period.endDate)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: appSpacing.sm }}>
        <StatusPill
          label={period.submittedAt ? '提出済み' : '未提出'}
          tone={period.submittedAt ? 'brand' : 'warning'}
        />
        <Text style={{ color: theme.textSecondary, fontSize: 10 }}>
          締切 {formatDateTime(period.requestDeadlineAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function PublishedScheduleRow({
  schedule,
  onPress,
}: {
  schedule: PublishedSchedulePeriod;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${schedule.name}のシフト表を画像で保存`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 88,
        padding: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.md,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: pressed ? theme.infoSoft : theme.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.borderSoft,
      })}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>
          {schedule.name}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>
          {schedule.storeName}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          {formatDateRange(schedule.startDate, schedule.endDate)}
        </Text>
      </View>
      <View
        style={{
          minHeight: 36,
          paddingHorizontal: appSpacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: appRadii.pill,
          backgroundColor: theme.infoSoft,
        }}>
        <Text style={{ color: theme.info, fontSize: 12, fontWeight: '900' }}>画像で保存</Text>
      </View>
    </Pressable>
  );
}

function UpcomingShiftRow({ assignment }: { assignment: ShiftAssignment }) {
  const theme = useAppTheme();
  return (
    <SectionCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.lg }}>
        <View style={{ width: 82, gap: 3 }}>
          <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
            {formatDateLabel(`${assignment.workDate}T00:00:00+09:00`)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            selectable
            style={{
              color: theme.text,
              fontSize: 18,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
            }}>
            {formatTime(assignment.startAt)}–{formatTime(assignment.endAt)}
          </Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            {assignment.storeName}
            {assignment.roleLabel ? ` · ${assignment.roleLabel}` : ''}
          </Text>
        </View>
        <StatusPill label="確定" tone="brand" />
      </View>
    </SectionCard>
  );
}

function SectionLabel({ eyebrow, title }: { eyebrow: string; title: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text
        style={{
          color: theme.brandStrong,
          fontSize: 9,
          fontWeight: '900',
          letterSpacing: 1.8,
          textTransform: 'uppercase',
        }}>
        {eyebrow}
      </Text>
      <Text selectable style={{ color: theme.text, fontSize: 21, fontWeight: '900' }}>
        {title}
      </Text>
    </View>
  );
}

function Metric({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: appSpacing.md,
        alignItems: 'center',
        gap: 2,
        borderLeftWidth: bordered ? 1 : 0,
        borderRightWidth: bordered ? 1 : 0,
        borderColor: theme.border,
      }}>
      <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>
        {label}
      </Text>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}

function SectionMessage({ title, description }: { title: string; description: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        padding: appSpacing.lg,
        gap: appSpacing.sm,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.border,
        backgroundColor: theme.surfaceMuted,
      }}>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 20 }}>
        {description}
      </Text>
    </View>
  );
}

function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${yearMonth}-01`,
    endDate: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

function formatDateRange(startDate: string, endDate: string) {
  const start = `${Number(startDate.slice(5, 7))}/${Number(startDate.slice(8, 10))}`;
  const end = `${Number(endDate.slice(5, 7))}/${Number(endDate.slice(8, 10))}`;
  return `${start}–${end}`;
}
