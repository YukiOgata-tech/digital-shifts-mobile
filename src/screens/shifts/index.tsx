import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { StoreScheduleSheet } from '@/components/shifts/store-schedule-sheet';
import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { StaffHeroCard } from '@/components/ui/staff-hero-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatDateLabel, formatDateTime, formatTime, toDateKey } from '@/features/staff/date';
import {
  useAssignments,
  useOpenShiftPeriods,
  useStorePublishedSchedule,
} from '@/features/staff/queries';

const segments = ['希望', '自分', '店舗'];

export function ShiftsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [yearMonth, setYearMonth] = useState(() => toDateKey(new Date()).slice(0, 7));
  const periods = useOpenShiftPeriods();
  const assignments = useAssignments(31, 93);
  const storeSchedule = useStorePublishedSchedule(yearMonth);
  const upcoming =
    assignments.data?.filter((item) => item.workDate >= toDateKey(new Date())) ?? [];
  const nextShift = upcoming[0];
  const upcomingMinutes = upcoming.reduce((total, item) => {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();
    return total + Math.max(0, (end - start) / 60_000 - item.breakMinutes);
  }, 0);
  const activeQuery =
    selectedIndex === 0 ? periods : selectedIndex === 1 ? assignments : storeSchedule;
  const isLoading = activeQuery.isLoading;
  const error = activeQuery.error;
  const refetch = activeQuery.refetch;

  const handleSegmentChange = (index: number) => {
    setSelectedIndex(index);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  return (
    <AppScreen
      contentContainerStyle={{ justifyContent: 'flex-start' }}
      refreshing={activeQuery.isFetching}
      onRefresh={() => void refetch()}>
      <StaffHeroCard eyebrow="My schedule" title="シフト">
        <View
          style={{
            padding: appSpacing.lg,
            gap: appSpacing.sm,
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(255,255,255,0.09)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
          }}>
          <Text
            selectable
            style={{
              color: theme.brandBright,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}>
            次の勤務
          </Text>
          {nextShift ? (
            <>
              <Text selectable style={{ color: theme.heroMuted, fontSize: 14, fontWeight: '800' }}>
                {formatDateLabel(`${nextShift.workDate}T00:00:00+09:00`)}
              </Text>
              <Text
                selectable
                style={{
                  color: theme.heroText,
                  fontSize: 32,
                  fontWeight: '900',
                  letterSpacing: -0.8,
                  fontVariant: ['tabular-nums'],
                }}>
                {formatTime(nextShift.startAt)}
                <Text style={{ color: 'rgba(255,255,255,0.42)', fontSize: 22 }}> - </Text>
                {formatTime(nextShift.endAt)}
              </Text>
              <Text selectable style={{ color: theme.heroMuted, fontSize: 13 }}>
                {nextShift.storeName}
                {nextShift.roleLabel ? ` · ${nextShift.roleLabel}` : ''}
              </Text>
            </>
          ) : (
            <Text selectable style={{ color: theme.heroMuted, fontSize: 14, fontWeight: '700' }}>
              今後の公開シフトはありません
            </Text>
          )}
        </View>
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: -appSpacing.lg,
            marginBottom: -appSpacing.lg,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.10)',
          }}>
          <HeroMetric label="今後" value={`${upcoming.length}件`} />
          <HeroMetric label="勤務時間" value={`${Math.round(upcomingMinutes / 60)}h`} />
          <HeroMetric
            label="店舗"
            value={`${new Set(upcoming.map((item) => item.storeId)).size}件`}
          />
        </View>
      </StaffHeroCard>

      <SegmentedControl
        selectedIndex={selectedIndex}
        values={segments}
        onChange={({ nativeEvent }) => handleSegmentChange(nativeEvent.selectedSegmentIndex)}
        style={{ height: 38 }}
      />

      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={error.message} onRetry={() => void refetch()} /> : null}

      {!isLoading && !error && selectedIndex === 0 ? (
        periods.data?.length ? (
          periods.data.map((period) => (
            <SectionCard key={period.id} tone={period.submittedAt ? 'brand' : 'warning'}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: appSpacing.md,
                }}>
                <View style={{ flex: 1, gap: appSpacing.xs }}>
                  <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                    {period.name}
                  </Text>
                  <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
                    {formatDateLabel(`${period.startDate}T00:00:00+09:00`)}〜
                    {formatDateLabel(`${period.endDate}T00:00:00+09:00`)}
                  </Text>
                  <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {period.storeName} · 期限 {formatDateTime(period.requestDeadlineAt)}
                  </Text>
                </View>
                <StatusPill
                  label={period.submittedAt ? '提出済み' : '下書き'}
                  tone={period.submittedAt ? 'brand' : 'warning'}
                />
              </View>
              <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
                入力済み {period.entries.length}日
              </Text>
              <NativeActionButton
                label={period.submittedAt ? '提出内容を確認' : '希望シフトを入力'}
                onPress={() =>
                  router.push(
                    { pathname: '/shift-request', params: { periodId: period.id } } as never,
                  )
                }
              />
            </SectionCard>
          ))
        ) : (
          <EmptyState
            title="受付中の希望シフトはありません"
            description="募集が開始されると、ここから希望を入力できます。"
          />
        )
      ) : null}

      {!isLoading && !error && selectedIndex === 1 ? (
        assignments.data?.length ? (
          <View style={{ gap: appSpacing.md }}>
            {upcoming.map((item) => (
                <SectionCard key={item.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.lg }}>
                    <View style={{ width: 92, gap: 3 }}>
                      <Text
                        selectable
                        style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                        {formatDateLabel(`${item.workDate}T00:00:00+09:00`)}
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
                        {formatTime(item.startAt)}–{formatTime(item.endAt)}
                      </Text>
                      <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {item.roleLabel ? `${item.roleLabel} · ` : ''}
                        {item.storeName}
                      </Text>
                    </View>
                    <StatusPill label="確定" tone="brand" />
                  </View>
                </SectionCard>
              ))}
          </View>
        ) : (
          <EmptyState title="確定シフトはありません" />
        )
      ) : null}

      {!isLoading && !error && selectedIndex === 2 ? (
        storeSchedule.data ? (
          <SectionCard>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: appSpacing.sm,
              }}>
              <MonthButton
                label="前月"
                onPress={() => setYearMonth((current) => shiftMonth(current, -1))}
              />
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
                  {formatMonthLabel(yearMonth)}
                </Text>
                <Text
                  selectable
                  numberOfLines={1}
                  style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                  {storeSchedule.data.storeName}
                </Text>
              </View>
              <MonthButton
                label="翌月"
                onPress={() => setYearMonth((current) => shiftMonth(current, 1))}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
              <ScheduleMetric label="確定" value={`${storeSchedule.data.assignments.length}件`} />
              <ScheduleMetric
                label="稼働"
                value={`${new Set(storeSchedule.data.assignments.map((item) => item.userId)).size}人`}
              />
              <ScheduleMetric label="掲載" value={`${storeSchedule.data.members.length}人`} />
            </View>

            {storeSchedule.data.members.length ? (
              <StoreScheduleSheet schedule={storeSchedule.data} />
            ) : (
              <EmptyState
                title="掲載対象のスタッフがいません"
                description="店舗のシフト表設定を確認してください。"
              />
            )}
          </SectionCard>
        ) : (
          <EmptyState
            title="店舗を選択してください"
            description="店舗タブで勤務先を選ぶと、公開シフト表を確認できます。"
          />
        )
      ) : null}
    </AppScreen>
  );
}

function MonthButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}のシフト表を表示`}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 64,
        minHeight: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: appRadii.sm,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
        opacity: pressed ? 0.72 : 1,
      })}>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function ScheduleMetric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: appSpacing.sm,
        borderRadius: appRadii.sm,
        backgroundColor: theme.surfaceMuted,
      }}>
      <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}

function shiftMonth(yearMonth: string, amount: number) {
  const [year, month] = yearMonth.split('-').map(Number);
  const next = new Date(year, month - 1 + amount, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  return `${year}年${Number(month)}月`;
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: appSpacing.xs,
        paddingTop: appSpacing.md,
      }}>
      <Text selectable style={{ color: theme.heroMuted, fontSize: 10, fontWeight: '800' }}>
        {label}
      </Text>
      <Text selectable style={{ color: theme.heroText, fontSize: 16, fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}
