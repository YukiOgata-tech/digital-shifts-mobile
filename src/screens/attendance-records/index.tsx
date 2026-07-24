import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { PageIntro } from '@/components/ui/page-intro';
import { SectionCard } from '@/components/ui/section-card';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatTime } from '@/features/staff/date';
import { useAttendanceRecords, useStaffIdentity } from '@/features/staff/queries';

export function AttendanceRecordsScreen() {
  const { storeId: initialStoreId } = useLocalSearchParams<{ storeId?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [storeId, setStoreId] = useState(initialStoreId ?? '');
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const records = useAttendanceRecords(`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`);
  const visibleRecords = useMemo(
    () =>
      (records.data ?? [])
        .filter((record) => !storeId || record.storeId === storeId)
        .sort((left, right) => right.workDate.localeCompare(left.workDate)),
    [records.data, storeId],
  );
  const completed = visibleRecords.filter((record) => record.status === 'completed');
  const workedMinutes = completed.reduce((total, record) => {
    if (!record.clockOutAt) return total;
    return (
      total +
      Math.max(
        0,
        Math.round(
          (new Date(record.clockOutAt).getTime() - new Date(record.clockInAt).getTime()) / 60_000,
        ) - record.breakMinutes,
      )
    );
  }, 0);

  if (staff.isLoading || records.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="過去の打刻記録を確認しています…" />
      </AppScreen>
    );
  }
  if (records.isError) {
    return (
      <AppScreen>
        <ErrorState message={records.error.message} onRetry={() => void records.refetch()} />
      </AppScreen>
    );
  }

  return (
    <AppScreen refreshing={records.isFetching} onRefresh={() => void records.refetch()}>
      <TabStackBackButton fallback="/(staff)/(attendance)" label="打刻" />
      <PageIntro
        eyebrow="My Records"
        title="過去の打刻記録"
        description="打刻漏れや時刻の誤りがある場合は、後から入力して管理者へ確認を依頼できます。"
      />

      <SectionCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <MonthButton
            label="‹"
            onPress={() =>
              setMonthDate(
                new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
              )
            }
          />
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
            {monthDate.getFullYear()}/{monthDate.getMonth() + 1}
          </Text>
          <MonthButton
            label="›"
            onPress={() =>
              setMonthDate(
                new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
              )
            }
          />
        </View>

        {staff.stores.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
            <FilterChip label="すべて" selected={!storeId} onPress={() => setStoreId('')} />
            {staff.stores.map((store) => (
              <FilterChip
                key={store.id}
                label={store.name}
                selected={storeId === store.id}
                onPress={() => setStoreId(store.id)}
              />
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
          <Summary label="出勤日数" value={`${completed.length}日`} />
          <Summary
            label="実働時間"
            value={`${Math.floor(workedMinutes / 60)}h${workedMinutes % 60 ? `${workedMinutes % 60}m` : ''}`}
          />
          <Summary
            label="要確認"
            value={`${visibleRecords.filter((record) => record.reviewStatus === 'needs_review').length}件`}
          />
        </View>
      </SectionCard>

      {visibleRecords.length ? (
        <View style={{ gap: appSpacing.sm }}>
          {visibleRecords.map((record) => {
            const storeName =
              record.storeName ??
              staff.stores.find((store) => store.id === record.storeId)?.name ??
              '店舗';
            return (
              <View
                key={record.id}
                style={{
                  padding: appSpacing.lg,
                  gap: appSpacing.sm,
                  borderRadius: appRadii.md,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor:
                    record.reviewStatus === 'needs_review' ? '#FCD34D' : theme.borderSoft,
                  backgroundColor: theme.surface,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.md }}>
                  <View style={{ width: 62 }}>
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>
                      {Number(record.workDate.slice(-2))}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {record.workDate.slice(0, 7)}
                    </Text>
                  </View>
                  <View style={{ minWidth: 0, flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
                      {formatTime(record.clockInAt)} →{' '}
                      {record.clockOutAt ? formatTime(record.clockOutAt) : '--:--'}
                    </Text>
                    <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {storeName}
                      {record.breakMinutes ? ` · 休憩${record.breakMinutes}分` : ''}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color:
                        record.reviewStatus === 'needs_review'
                          ? theme.warning
                          : record.status === 'open'
                            ? theme.brandStrong
                            : theme.textSecondary,
                      fontSize: 11,
                      fontWeight: '900',
                    }}>
                    {record.reviewStatus === 'needs_review'
                      ? '要確認'
                      : record.status === 'open'
                        ? '出勤中'
                        : '確定'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="この月の記録はありません"
          description="打刻すると記録がここに表示されます。"
        />
      )}

      <NativeActionButton
        label="打刻漏れを後から入力"
        variant="outlined"
        onPress={() => router.push('/attendance-adjustment')}
      />
    </AppScreen>
  );
}

function MonthButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: appRadii.sm,
        backgroundColor: theme.surfaceMuted,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.pill,
        backgroundColor: selected ? theme.brandSoft : theme.surfaceMuted,
      }}>
      <Text style={{ color: selected ? theme.brandStrong : theme.textSecondary, fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, padding: appSpacing.sm, borderRadius: appRadii.sm, backgroundColor: theme.surfaceMuted }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}
