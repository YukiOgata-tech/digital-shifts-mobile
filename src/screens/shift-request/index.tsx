import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatDateLabel, formatTime } from '@/features/staff/date';
import {
  useOpenShiftPeriods,
  useSaveShiftRequest,
  useSetShiftRequestSubmitted,
} from '@/features/staff/queries';
import type { ShiftRequestEntry } from '@/features/staff/types';

type DayChoice = ShiftRequestEntry['entryType'] | null;
type DaySelection = {
  entryType: ShiftRequestEntry['entryType'];
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
};

const choices: {
  value: DayChoice;
  label: string;
  tone: 'neutral' | 'brand' | 'info' | 'danger';
}[] = [
  { value: null, label: '未入力', tone: 'neutral' },
  { value: 'available', label: '出勤可', tone: 'brand' },
  { value: 'preferred', label: '希望', tone: 'info' },
  { value: 'unavailable', label: '休み', tone: 'danger' },
];

function enumerateDates(startDate: string, endDate: string) {
  const result: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00+09:00`);
  const last = new Date(`${endDate}T00:00:00+09:00`);
  while (cursor <= last && result.length < 62) {
    result.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(cursor),
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function ShiftRequestScreen() {
  const { periodId } = useLocalSearchParams<{ periodId: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const periods = useOpenShiftPeriods();
  const save = useSaveShiftRequest();
  const setSubmitted = useSetShiftRequestSubmitted();
  const period = periods.data?.find((item) => item.id === periodId);
  const dates = useMemo(
    () => (period ? enumerateDates(period.startDate, period.endDate) : []),
    [period],
  );
  const initialSelections = useMemo(
    () =>
      Object.fromEntries(
        (period?.entries ?? []).map((entry) => [
          entry.workDate,
          {
            entryType: entry.entryType,
            isAllDay: entry.isAllDay,
            startTime: entry.startAt ? formatTime(entry.startAt) : '09:00',
            endTime: entry.endAt ? formatTime(entry.endAt) : '18:00',
            note: entry.note ?? '',
          } satisfies DaySelection,
        ]),
      ) as Record<string, DaySelection | undefined>,
    [period?.entries],
  );
  const [selectionDraft, setSelectionDraft] = useState<{
    periodId: string;
    values: Record<string, DaySelection | undefined>;
  } | null>(null);
  const selections =
    selectionDraft && selectionDraft.periodId === period?.id
      ? selectionDraft.values
      : initialSelections;

  if (periods.isLoading) {
    return (
      <AppScreen>
        <LoadingState />
      </AppScreen>
    );
  }
  if (periods.isError) {
    return (
      <AppScreen>
        <ErrorState message={periods.error.message} onRetry={() => void periods.refetch()} />
      </AppScreen>
    );
  }
  if (!period) {
    return (
      <AppScreen>
        <EmptyState
          title="希望シフト期間が見つかりません"
          description="提出期限が終了したか、所属店舗が切り替わった可能性があります。"
        />
      </AppScreen>
    );
  }

  const cycle = (date: string) => {
    if (period.submittedAt || period.closedDates.includes(date)) return;
    const current = choices.findIndex(
      (choice) => choice.value === (selections[date]?.entryType ?? null),
    );
    const next = choices[(current + 1) % choices.length].value;
    setSelectionDraft({
      periodId: period.id,
      values: {
        ...selections,
        [date]: next
          ? {
              entryType: next,
              isAllDay: true,
              startTime: selections[date]?.startTime ?? '09:00',
              endTime: selections[date]?.endTime ?? '18:00',
              note: selections[date]?.note ?? '',
            }
          : undefined,
      },
    });
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  const updateDay = (date: string, patch: Partial<DaySelection>) => {
    const current = selections[date];
    if (!current) return;
    setSelectionDraft({
      periodId: period.id,
      values: { ...selections, [date]: { ...current, ...patch } },
    });
  };

  const saveDraft = () => {
    for (const date of dates) {
      const selection = selections[date];
      if (
        selection &&
        !selection.isAllDay &&
        (!/^\d{2}:\d{2}$/.test(selection.startTime) ||
          !/^\d{2}:\d{2}$/.test(selection.endTime))
      ) {
        Alert.alert(
          '時刻を確認してください',
          `${formatDateLabel(`${date}T00:00:00+09:00`)}の時刻は09:00の形式で入力してください。`,
        );
        return;
      }
    }

    const entries = dates.flatMap((workDate) => {
      const selection = selections[workDate];
      if (!selection || period.closedDates.includes(workDate)) return [];
      const startAt = selection.isAllDay
        ? null
        : `${workDate}T${selection.startTime}:00+09:00`;
      let endAt = selection.isAllDay
        ? null
        : `${workDate}T${selection.endTime}:00+09:00`;
      if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
        const nextDay = new Date(`${workDate}T00:00:00+09:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(nextDay);
        endAt = `${nextDate}T${selection.endTime}:00+09:00`;
      }
      return [
        {
          workDate,
          entryType: selection.entryType,
          isAllDay: selection.isAllDay,
          startAt,
          endAt,
          note: selection.note.trim() || null,
        },
      ];
    });
    save.mutate(
      {
        userId: '',
        tenantId: '',
        period,
        entries,
        affectedDates: dates,
      },
      {
        onSuccess: () => Alert.alert('保存しました', '希望シフトを下書き保存しました。'),
        onError: (error) => Alert.alert('保存できませんでした', error.message),
      },
    );
  };

  const toggleSubmit = () => {
    if (!period.requestId) {
      Alert.alert('提出できません', '先に1日以上入力して、下書き保存してください。');
      return;
    }
    if (!period.submittedAt && period.entries.length === 0) {
      Alert.alert('提出できません', '1日以上の希望を入力してください。');
      return;
    }
    const submitted = !period.submittedAt;
    Alert.alert(
      submitted ? '希望シフトを提出しますか？' : '下書きに戻しますか？',
      submitted ? '提出後も期限内であれば下書きに戻せます。' : '編集後はもう一度提出してください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: submitted ? '提出する' : '下書きに戻す',
          onPress: () =>
            setSubmitted.mutate(
              { requestId: period.requestId!, submitted },
              {
                onSuccess: () => {
                  void periods.refetch();
                  Alert.alert(submitted ? '提出しました' : '下書きに戻しました');
                },
                onError: (error) => Alert.alert('更新できませんでした', error.message),
              },
            ),
        },
      ],
    );
  };

  return (
    <AppScreen>
      <SectionCard tone={period.submittedAt ? 'brand' : 'warning'}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: appSpacing.md }}>
          <View style={{ flex: 1, gap: appSpacing.xs }}>
            <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>
              {period.name}
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              {period.storeName}
            </Text>
          </View>
          <StatusPill
            label={period.submittedAt ? '提出済み' : '下書き'}
            tone={period.submittedAt ? 'brand' : 'warning'}
          />
        </View>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
          各日をタップして「未入力 → 出勤可 → 希望 → 休み」を切り替えます。
        </Text>
      </SectionCard>

      <View style={{ gap: appSpacing.sm }}>
        {dates.map((date) => {
          const isClosed = period.closedDates.includes(date);
          const selection = selections[date];
          const choice =
            choices.find((item) => item.value === (selection?.entryType ?? null)) ?? choices[0];
          return (
            <View
              key={date}
              style={{
                padding: appSpacing.lg,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                gap: appSpacing.md,
                opacity: period.submittedAt ? 0.75 : 1,
              }}>
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(period.submittedAt) || isClosed}
                onPress={() => cycle(date)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: appSpacing.md,
                  opacity: pressed ? 0.65 : 1,
                })}>
                <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
                  {formatDateLabel(`${date}T00:00:00+09:00`, {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </Text>
                <StatusPill
                  label={isClosed ? '休業日' : choice.label}
                  tone={isClosed ? 'neutral' : choice.tone}
                />
              </Pressable>

              {!isClosed && selection && selection.entryType !== 'unavailable' ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                    <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
                      終日可能
                    </Text>
                    <Switch
                      value={selection.isAllDay}
                      disabled={Boolean(period.submittedAt)}
                      onValueChange={(value) => updateDay(date, { isAllDay: value })}
                    />
                  </View>
                  {!selection.isAllDay ? (
                    <View style={{ flexDirection: 'row', gap: appSpacing.md }}>
                      <TextInput
                        value={selection.startTime}
                        onChangeText={(value) => updateDay(date, { startTime: value })}
                        editable={!period.submittedAt}
                        keyboardType="numbers-and-punctuation"
                        placeholder="09:00"
                        placeholderTextColor={theme.textSecondary}
                        style={{
                          flex: 1,
                          minHeight: 46,
                          paddingHorizontal: appSpacing.md,
                          borderRadius: appRadii.sm,
                          backgroundColor: theme.surfaceMuted,
                          color: theme.text,
                          fontSize: 16,
                          fontVariant: ['tabular-nums'],
                        }}
                      />
                      <Text style={{ alignSelf: 'center', color: theme.textSecondary }}>〜</Text>
                      <TextInput
                        value={selection.endTime}
                        onChangeText={(value) => updateDay(date, { endTime: value })}
                        editable={!period.submittedAt}
                        keyboardType="numbers-and-punctuation"
                        placeholder="18:00"
                        placeholderTextColor={theme.textSecondary}
                        style={{
                          flex: 1,
                          minHeight: 46,
                          paddingHorizontal: appSpacing.md,
                          borderRadius: appRadii.sm,
                          backgroundColor: theme.surfaceMuted,
                          color: theme.text,
                          fontSize: 16,
                          fontVariant: ['tabular-nums'],
                        }}
                      />
                    </View>
                  ) : null}
                  <TextInput
                    value={selection.note}
                    onChangeText={(value) => updateDay(date, { note: value })}
                    editable={!period.submittedAt}
                    maxLength={400}
                    placeholder="メモ（任意）"
                    placeholderTextColor={theme.textSecondary}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: appSpacing.md,
                      borderRadius: appRadii.sm,
                      backgroundColor: theme.surfaceMuted,
                      color: theme.text,
                      fontSize: 14,
                    }}
                  />
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      {!period.submittedAt ? (
        <NativeActionButton
          label={save.isPending ? '保存中…' : '下書き保存'}
          disabled={save.isPending}
          onPress={saveDraft}
        />
      ) : null}
      <NativeActionButton
        label={
          setSubmitted.isPending
            ? '更新中…'
            : period.submittedAt
              ? '下書きに戻す'
              : '希望シフトを提出'
        }
        variant={period.submittedAt ? 'outlined' : 'filled'}
        disabled={save.isPending || setSubmitted.isPending}
        haptic="success"
        onPress={toggleSubmit}
      />
      <NativeActionButton label="シフト一覧へ戻る" variant="text" onPress={() => router.back()} />
    </AppScreen>
  );
}
