import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ShiftRequestCalendar } from '@/components/shifts/shift-request-calendar';
import { ShiftRequestControls } from '@/components/shifts/shift-request-controls';
import { ShiftRequestEntrySheet } from '@/components/shifts/shift-request-entry-sheet';
import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  buildCalendarDays,
  copyPreviousWeek,
  createDefaultBrush,
  describeEntry,
  draftEntries,
  draftSignature,
  entriesToDraft,
  enumerateDateKeys,
  fillUnentered,
  isValidTime,
  type ShiftRequestBrush,
  type ShiftRequestDraft,
  type ShiftRequestDraftEntry,
  validateDraft,
} from '@/features/shift-request/draft';
import {
  type MobilePreferences,
  readMobilePreferences,
  resolveBrushForDate,
} from '@/features/preferences/mobile-preferences';
import { formatDateLabel } from '@/features/staff/date';
import {
  useOpenShiftPeriods,
  useSaveShiftRequest,
  useSetShiftRequestSubmitted,
  useStaffIdentity,
} from '@/features/staff/queries';

type DraftState = {
  periodId: string;
  values: ShiftRequestDraft;
  baselineSignature: string;
  serverSignature: string;
};

type BrushState = {
  periodId: string;
  value: ShiftRequestBrush;
};

export function ShiftRequestScreen() {
  const { periodId } = useLocalSearchParams<{ periodId: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const periods = useOpenShiftPeriods();
  const staff = useStaffIdentity();
  const save = useSaveShiftRequest();
  const setSubmitted = useSetShiftRequestSubmitted();
  const period = periods.data?.find((item) => item.id === periodId);

  const dateKeys = useMemo(
    () => (period ? enumerateDateKeys(period.startDate, period.endDate) : []),
    [period],
  );
  const closedReasons = useMemo(
    () =>
      new Map((period?.closedDays ?? []).map((day) => [day.workDate, day.reason])),
    [period?.closedDays],
  );
  const editableDates = useMemo(
    () => new Set(dateKeys.filter((date) => !closedReasons.has(date))),
    [closedReasons, dateKeys],
  );
  const calendarDays = useMemo(
    () => (period ? buildCalendarDays(period.startDate, period.endDate) : []),
    [period],
  );
  const serverDraft = useMemo(
    () => (period ? entriesToDraft(period.entries, period.storeTimezone) : {}),
    [period],
  );
  const serverSignature = useMemo(
    () => draftSignature(serverDraft, editableDates),
    [editableDates, serverDraft],
  );
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [brushState, setBrushState] = useState<BrushState | null>(null);
  const [dragEnabled, setDragEnabled] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [mobilePreferences, setMobilePreferences] = useState<MobilePreferences | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!period) return;
    setDraftState((current) => {
      if (!current || current.periodId !== period.id) {
        return {
          periodId: period.id,
          values: serverDraft,
          baselineSignature: serverSignature,
          serverSignature,
        };
      }
      const dirty =
        draftSignature(current.values, editableDates) !== current.baselineSignature;
      if (!dirty && current.serverSignature !== serverSignature) {
        return {
          periodId: period.id,
          values: serverDraft,
          baselineSignature: serverSignature,
          serverSignature,
        };
      }
      return current;
    });
    setBrushState((current) =>
      current?.periodId === period.id
        ? current
        : {
            periodId: period.id,
            value: createDefaultBrush(period.useTimeSlots, period.timeSlots),
          },
    );
    setDragEnabled(false);
    setEditingDate(null);
  }, [editableDates, period, serverDraft, serverSignature]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!staff.userId) return;
      let active = true;
      void readMobilePreferences(staff.userId).then((value) => {
        if (active) setMobilePreferences(value);
      });
      return () => {
        active = false;
      };
    }, [staff.userId]),
  );

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

  const values =
    draftState?.periodId === period.id ? draftState.values : serverDraft;
  const brush =
    brushState?.periodId === period.id
      ? brushState.value
      : createDefaultBrush(period.useTimeSlots, period.timeSlots);
  const currentSignature = draftSignature(values, editableDates);
  const baselineSignature =
    draftState?.periodId === period.id
      ? draftState.baselineSignature
      : serverSignature;
  const isDirty = currentSignature !== baselineSignature;
  const deadlinePassed = now >= new Date(period.requestDeadlineAt).getTime();
  const isReadOnly = Boolean(period.submittedAt) || deadlinePassed;
  const isBusy = save.isPending || setSubmitted.isPending;
  const entered = draftEntries(values, editableDates);

  const changeDraft = (next: ShiftRequestDraft) => {
    if (isReadOnly || isBusy) return;
    setDraftState((current) => ({
      periodId: period.id,
      values: next,
      baselineSignature:
        current?.periodId === period.id
          ? current.baselineSignature
          : serverSignature,
      serverSignature:
        current?.periodId === period.id
          ? current.serverSignature
          : serverSignature,
    }));
  };

  const validate = () => {
    const error = validateDraft(values, editableDates);
    if (error) {
      Alert.alert('入力内容を確認してください', error);
      return false;
    }
    return true;
  };

  const saveCurrentDraft = async () => {
    const validationError = validateDraft(values, editableDates);
    if (validationError) throw new Error(validationError);
    const requestId = await save.mutateAsync({
      userId: '',
      tenantId: '',
      period,
      entries: entered.map((entry) => ({
        workDate: entry.workDate,
        entryType: entry.entryType,
        isAllDay: entry.isAllDay,
        startTime: entry.isAllDay ? null : entry.startTime,
        endTime: entry.isAllDay ? null : entry.endTime,
        timeSlotId:
          entry.isAllDay || !period.useTimeSlots ? null : entry.timeSlotId,
        note: entry.note.trim() || null,
      })),
    });
    setDraftState((current) =>
      current?.periodId === period.id
        ? {
            ...current,
            baselineSignature: draftSignature(current.values, editableDates),
          }
        : current,
    );
    return requestId;
  };

  const handleSave = async () => {
    try {
      await saveCurrentDraft();
      Alert.alert('保存しました', '端末で編集した内容を下書き保存しました。');
    } catch (error) {
      if (save.isError || error instanceof Error) {
        Alert.alert(
          '保存できませんでした',
          error instanceof Error ? error.message : '通信状態を確認して、もう一度お試しください。',
        );
      }
    }
  };

  const confirmSubmit = () => {
    if (!entered.length) {
      Alert.alert('提出できません', '1日以上の希望を入力してください。');
      return;
    }
    if (!validate()) return;
    Alert.alert(
      '希望シフトを提出しますか？',
      isDirty
        ? '未保存の変更を保存してから提出します。提出後の編集には下書きへ戻す操作が必要です。'
        : '提出後の編集には下書きへ戻す操作が必要です。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '提出する',
          onPress: () => {
            void (async () => {
              try {
                const requestId =
                  isDirty || !period.requestId
                    ? await saveCurrentDraft()
                    : period.requestId;
                await setSubmitted.mutateAsync({ requestId, submitted: true });
                setDragEnabled(false);
                Alert.alert('提出しました', '希望シフトの提出が完了しました。');
              } catch (error) {
                Alert.alert(
                  '提出できませんでした',
                  error instanceof Error ? error.message : '通信状態を確認してください。',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const confirmReturnToDraft = () => {
    if (!period.requestId) return;
    Alert.alert(
      '下書きに戻しますか？',
      '期限内であれば編集して、もう一度提出できます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '下書きに戻す',
          onPress: () => {
            void setSubmitted
              .mutateAsync({ requestId: period.requestId!, submitted: false })
              .then(() => Alert.alert('下書きに戻しました'))
              .catch((error: Error) =>
                Alert.alert('更新できませんでした', error.message),
              );
          },
        },
      ],
    );
  };

  const updateEditor = (entry: ShiftRequestDraftEntry) => {
    if (
      !entry.isAllDay &&
      (!isValidTime(entry.startTime) || !isValidTime(entry.endTime))
    ) {
      Alert.alert('時刻を確認してください', '00:00〜23:59の形式で入力してください。');
      return;
    }
    changeDraft({ ...values, [entry.workDate]: entry });
    setEditingDate(null);
  };

  return (
    <>
      <AppScreen contentContainerStyle={{ justifyContent: 'flex-start' }}>
        <SectionCard tone={period.submittedAt ? 'brand' : deadlinePassed ? 'default' : 'warning'}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: appSpacing.md,
            }}>
            <View style={{ flex: 1, gap: appSpacing.xs }}>
              <Text selectable style={{ color: theme.text, fontSize: 21, fontWeight: '800' }}>
                {period.name}
              </Text>
              <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
                {period.storeName}
              </Text>
            </View>
            <StatusPill
              label={
                period.submittedAt
                  ? '提出済み'
                  : deadlinePassed
                    ? '期限終了'
                    : isDirty
                      ? '未保存'
                      : '下書き'
              }
              tone={
                period.submittedAt
                  ? 'brand'
                  : deadlinePassed
                    ? 'danger'
                    : isDirty
                      ? 'warning'
                      : 'neutral'
              }
            />
          </View>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            対象 {formatDateLabel(`${period.startDate}T00:00:00+09:00`)}〜
            {formatDateLabel(`${period.endDate}T00:00:00+09:00`)}
          </Text>
          <Text
            selectable
            style={{
              color: deadlinePassed ? theme.danger : theme.textSecondary,
              fontSize: 13,
              fontWeight: deadlinePassed ? '700' : '400',
            }}>
            提出期限 {new Intl.DateTimeFormat('ja-JP', {
              timeZone: period.storeTimezone,
              month: 'long',
              day: 'numeric',
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(period.requestDeadlineAt))}
          </Text>
        </SectionCard>

        <SectionCard>
          <ShiftRequestControls
            brush={brush}
            useTimeSlots={period.useTimeSlots}
            timeSlots={period.timeSlots}
            dragEnabled={dragEnabled}
            disabled={isReadOnly || isBusy}
            onBrushChange={(value) => setBrushState({ periodId: period.id, value })}
            onDragEnabledChange={setDragEnabled}
            onFillUnentered={() => {
              if (!brush.isAllDay && (!isValidTime(brush.startTime) || !isValidTime(brush.endTime))) {
                Alert.alert('時刻を確認してください', '00:00〜23:59の形式で入力してください。');
                return;
              }
              const result = fillUnentered({ draft: values, brush, editableDates });
              if (!result.count) {
                Alert.alert('未入力日はありません');
                return;
              }
              changeDraft(result.draft);
            }}
            onCopyPreviousWeek={() => {
              const result = copyPreviousWeek(values, editableDates);
              if (!result.count) {
                Alert.alert('コピーできる前週の入力がありません');
                return;
              }
              changeDraft(result.draft);
              Alert.alert(`${result.count}日分をコピーしました`);
            }}
            onClearAll={() => {
              if (!entered.length) {
                Alert.alert('削除する入力はありません');
                return;
              }
              Alert.alert(
                '入力をすべて削除しますか？',
                `${entered.length}日分を端末上の下書きから削除します。確定には下書き保存が必要です。`,
                [
                  { text: 'キャンセル', style: 'cancel' },
                  {
                    text: '全削除',
                    style: 'destructive',
                    onPress: () => changeDraft({}),
                  },
                ],
              );
            }}
          />
        </SectionCard>

        {dragEnabled ? (
          <View
            style={{
              padding: appSpacing.md,
              borderRadius: appRadii.md,
              backgroundColor: theme.infoSoft,
              gap: appSpacing.xs,
            }}>
            <Text style={{ color: theme.info, fontSize: 13, fontWeight: '800' }}>
              なぞり入力中
            </Text>
            <Text style={{ color: theme.info, fontSize: 12 }}>
              カレンダー内の1日目から指を滑らせます。指を離すまではプレビューです。画面を移動するときは「タップ入力」に戻してください。
            </Text>
          </View>
        ) : (
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            タップで反映・同じ内容を再タップで削除。長押しすると時刻やメモを個別編集できます。
          </Text>
        )}

        <ShiftRequestCalendar
          days={calendarDays}
          draft={values}
          brush={brush}
          editableDates={editableDates}
          closedReasons={closedReasons}
          dragEnabled={dragEnabled}
          disabled={isReadOnly || isBusy}
          brushForDate={(date) => resolveBrushForDate(mobilePreferences, date, brush)}
          onChange={changeDraft}
          onEdit={setEditingDate}
        />

        <SectionCard>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
              入力内容
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              {entered.length}/{editableDates.size}日
            </Text>
          </View>
          {entered.length ? (
            entered.map((entry) => (
              <Pressable
                key={entry.workDate}
                accessibilityRole="button"
                accessibilityLabel={`${entry.workDate} ${describeEntry(entry)}を編集`}
                disabled={isReadOnly || isBusy}
                onPress={() => setEditingDate(entry.workDate)}
                style={({ pressed }) => ({
                  minHeight: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: appSpacing.md,
                  paddingVertical: appSpacing.sm,
                  borderBottomWidth: 1,
                  borderColor: theme.borderSoft,
                  opacity: pressed ? 0.6 : isReadOnly ? 0.65 : 1,
                })}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                    {formatDateLabel(`${entry.workDate}T00:00:00+09:00`, {
                      month: 'numeric',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </Text>
                  {entry.note ? (
                    <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {entry.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {describeEntry(entry)}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              まだ入力がありません。カレンダーから勤務可・優先希望・NGを入力してください。
            </Text>
          )}
        </SectionCard>

        {!period.submittedAt && !deadlinePassed ? (
          <NativeActionButton
            label={save.isPending ? '保存中…' : isDirty ? '下書き保存' : '保存済み'}
            disabled={isBusy || !isDirty}
            onPress={() => void handleSave()}
          />
        ) : null}
        {period.submittedAt ? (
          <NativeActionButton
            label={setSubmitted.isPending ? '更新中…' : '下書きに戻す'}
            variant="outlined"
            disabled={isBusy || deadlinePassed}
            onPress={confirmReturnToDraft}
          />
        ) : !deadlinePassed ? (
          <NativeActionButton
            label={isBusy ? '処理中…' : '希望シフトを提出'}
            disabled={isBusy || !entered.length}
            haptic="success"
            onPress={confirmSubmit}
          />
        ) : null}
        <NativeActionButton label="シフト一覧へ戻る" variant="text" onPress={() => router.back()} />
      </AppScreen>

      {editingDate ? (
        <ShiftRequestEntrySheet
          key={editingDate}
          date={editingDate}
          entry={values[editingDate]}
          defaultBrush={resolveBrushForDate(mobilePreferences, editingDate, brush)}
          onClose={() => setEditingDate(null)}
          onSave={updateEditor}
          onDelete={() => {
            const next = { ...values };
            delete next[editingDate];
            changeDraft(next);
            setEditingDate(null);
          }}
        />
      ) : null}
    </>
  );
}
