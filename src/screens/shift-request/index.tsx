import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ShiftRequestCalendar } from '@/components/shifts/shift-request-calendar';
import { ShiftRequestControls } from '@/components/shifts/shift-request-controls';
import { ShiftRequestEntrySheet } from '@/components/shifts/shift-request-entry-sheet';
import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
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
  resolveTimeSlot,
  timeSlotPalette,
} from '@/features/shift-request/time-slot-colors';
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
import type { ShiftTimeSlot } from '@/features/staff/types';

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
  const periods = useOpenShiftPeriods(true);
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [detailExpanded, setDetailExpanded] = useState(false);
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
    setViewMode('calendar');
    setDetailExpanded(false);
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

  const missingDays = Math.max(0, editableDates.size - entered.length);
  const summary = summarizeEntries(entered);
  const currentStep = period.submittedAt ? 3 : entered.length ? 2 : 1;
  const draftStatus = period.submittedAt
    ? '提出済み'
    : deadlinePassed
      ? '受付終了'
      : isDirty
        ? '未保存'
        : '下書き中';
  const openRules = () => {
    Alert.alert(
      'シフト提出のルール',
      `対象期間内の勤務可能・優先希望・NGを入力してください。\n\nNGは終日固定です。提出後に修正する場合は、期限内に下書きへ戻して再提出します。\n\n提出期限：${formatDeadline(period.requestDeadlineAt, period.storeTimezone)}`,
    );
  };
  const openDetailedEditor = () => {
    const target =
      [...editableDates].sort().find((date) => !values[date]) ??
      entered[0]?.workDate;
    if (!target) {
      Alert.alert('入力できる日がありません');
      return;
    }
    setEditingDate(target);
  };

  return (
    <>
      <AppScreen
        contentContainerStyle={{
          justifyContent: 'flex-start',
          paddingTop: appSpacing.sm,
          paddingBottom: appSpacing.xxl,
        }}>
        <View
          style={{
            minHeight: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: appSpacing.sm,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="シフト一覧へ戻る"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: appRadii.pill,
              opacity: pressed ? 0.55 : 1,
            })}>
            <AppIcon name="arrow.left" color={theme.textSecondary} size={20} fallback="←" />
          </Pressable>
          <Text
            accessibilityRole="header"
            selectable
            style={{
              color: theme.text,
              fontSize: 24,
              fontWeight: '900',
              letterSpacing: -0.5,
            }}>
            シフト提出
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="提出のルールを確認"
            hitSlop={6}
            onPress={openRules}
            style={({ pressed }) => ({
              minWidth: 90,
              minHeight: 44,
              alignItems: 'flex-end',
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
            })}>
            <Text style={{ color: theme.brandStrong, fontSize: 14, fontWeight: '900' }}>
              提出のルール
            </Text>
          </Pressable>
        </View>

        <View
          accessibilityLabel={`店舗 ${period.storeName} シフト期間 ${period.name}`}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800' }}>
            店舗
          </Text>
          <Text style={{ color: theme.border }}>›</Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800' }}>
            {period.storeName}
          </Text>
          <Text style={{ color: theme.border }}>›</Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800' }}>
            シフト期間
          </Text>
          <Text style={{ color: theme.border }}>›</Text>
          <Text selectable style={{ color: theme.text, fontSize: 11, fontWeight: '900' }}>
            {period.name}
          </Text>
        </View>

        <StepProgress current={currentStep} />

        <View
          style={{
            overflow: 'hidden',
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.borderSoft,
            backgroundColor: theme.surface,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
          }}>
          <View
            style={{
              padding: appSpacing.md,
              gap: appSpacing.sm,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: appSpacing.sm,
              }}>
              <AppIcon name="calendar" color={theme.textSecondary} size={19} fallback="□" />
              <Text selectable style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '900' }}>
                提出対象期間
              </Text>
            </View>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: 20,
                fontWeight: '900',
                letterSpacing: -0.3,
              }}>
              {formatFullDateRange(period.startDate, period.endDate)}
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {period.storeName} / {period.name}
            </Text>
          </View>
          <View
            style={{
              minHeight: 42,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: appSpacing.sm,
              paddingHorizontal: appSpacing.md,
              backgroundColor: missingDays ? theme.brandSoft : theme.infoSoft,
            }}>
            <AppIcon
              name={missingDays ? 'checkmark' : 'checkmark.circle.fill'}
              color={theme.brandStrong}
              size={18}
              fallback="✓"
            />
            <Text
              selectable
              style={{ color: theme.brandStrong, fontSize: 14, fontWeight: '900' }}>
              {missingDays ? `${missingDays}日分が未入力です` : 'すべて入力済みです'}
            </Text>
          </View>
        </View>

        <View
          style={{
            overflow: 'hidden',
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
          }}>
          <View style={{ flexDirection: 'row' }}>
            <ViewModeTab
              selected={viewMode === 'calendar'}
              icon="calendar"
              label="カレンダーで確認"
              onPress={() => setViewMode('calendar')}
            />
            <ViewModeTab
              selected={viewMode === 'list'}
              icon="checklist"
              label="リストで確認"
              onPress={() => {
                setDragEnabled(false);
                setViewMode('list');
              }}
            />
          </View>

          {viewMode === 'calendar' ? (
            <>
              {!isReadOnly ? (
                <ShiftRequestControls
                  brush={brush}
                  useTimeSlots={period.useTimeSlots}
                  timeSlots={period.timeSlots}
                  dragEnabled={dragEnabled}
                  disabled={isBusy}
                  onBrushChange={(value) => setBrushState({ periodId: period.id, value })}
                  onDragEnabledChange={setDragEnabled}
                  onFillUnentered={() => {
                    if (
                      !brush.isAllDay &&
                      (!isValidTime(brush.startTime) || !isValidTime(brush.endTime))
                    ) {
                      Alert.alert(
                        '時刻を確認してください',
                        '00:00〜23:59の形式で入力してください。',
                      );
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
              ) : (
                <View
                  style={{
                    padding: appSpacing.md,
                    backgroundColor: period.submittedAt
                      ? theme.brandSoft
                      : theme.surfaceMuted,
                  }}>
                  <Text
                    selectable
                    style={{
                      color: period.submittedAt
                        ? theme.brandStrong
                        : theme.textSecondary,
                      fontSize: 12,
                      fontWeight: '800',
                    }}>
                    {period.submittedAt
                      ? '提出済みの内容です。修正するには下書きへ戻してください。'
                      : '提出期限が終了したため編集できません。'}
                  </Text>
                </View>
              )}
              <ShiftRequestCalendar
                embedded
                days={calendarDays}
                draft={values}
                brush={brush}
                timeSlots={period.timeSlots}
                editableDates={editableDates}
                closedReasons={closedReasons}
                dragEnabled={dragEnabled}
                disabled={isReadOnly || isBusy}
                brushForDate={(date) =>
                  resolveBrushForDate(mobilePreferences, date, brush)
                }
                onChange={changeDraft}
                onEdit={setEditingDate}
              />
            </>
          ) : (
            <View style={{ padding: appSpacing.md }}>
              <EntryList
                entries={entered}
                timeSlots={period.timeSlots}
                disabled={isReadOnly || isBusy}
                onEdit={setEditingDate}
              />
            </View>
          )}
        </View>

        <SummaryCard
          startDate={period.startDate}
          endDate={period.endDate}
          workDays={summary.workDays}
          minutes={summary.minutes}
          restDays={summary.restDays}
          onViewDetails={() => {
            setDragEnabled(false);
            setViewMode('list');
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="提出後の修正ルールを確認"
          onPress={openRules}
          style={({ pressed }) => ({
            minHeight: 82,
            flexDirection: 'row',
            alignItems: 'center',
            gap: appSpacing.md,
            padding: appSpacing.md,
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: '#FDE68A',
            backgroundColor: '#FFFBEB',
            opacity: pressed ? 0.7 : 1,
            boxShadow: '0 7px 18px rgba(180, 83, 9, 0.08)',
          })}>
          <View
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: appRadii.pill,
              backgroundColor: '#F59E0B',
            }}>
            <AppIcon name="exclamationmark" color="#FFFFFF" size={20} fallback="!" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '900' }}>
              提出後の修正は、下書きへ戻す操作が必要です
            </Text>
            <Text
              selectable
              style={{
                color: deadlinePassed ? theme.danger : theme.textSecondary,
                fontSize: 11,
                fontWeight: '800',
              }}>
              提出期限: {formatDeadline(period.requestDeadlineAt, period.storeTimezone)}
            </Text>
          </View>
          <AppIcon name="chevron.right" color={theme.warning} size={17} fallback="›" />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: appSpacing.md }}>
          <ActionButton
            grow
            label={period.submittedAt ? '内容を確認する' : '内容を編集する'}
            variant="outlined"
            disabled={isBusy}
            onPress={() => {
              setDragEnabled(false);
              setViewMode(period.submittedAt ? 'list' : 'calendar');
            }}
          />
          <ActionButton
            grow
            label={
              period.submittedAt
                ? '提出済み'
                : entered.length
                  ? '希望を提出する'
                  : '希望を追加する'
            }
            disabled={isBusy || deadlinePassed || Boolean(period.submittedAt) || !entered.length}
            onPress={confirmSubmit}
          />
        </View>

        <View
          style={{
            overflow: 'hidden',
            borderRadius: appRadii.md,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.text,
            backgroundColor: theme.surface,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailExpanded }}
            onPress={() => setDetailExpanded((value) => !value)}
            style={({ pressed }) => ({
              minHeight: 68,
              flexDirection: 'row',
              alignItems: 'center',
              gap: appSpacing.md,
              padding: appSpacing.md,
              opacity: pressed ? 0.65 : 1,
            })}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
                詳しく指定して追加
              </Text>
              <Text selectable style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 17 }}>
                時間やメモを細かく指定したいとき用。普段は上のカレンダーをタップでOKです。
              </Text>
            </View>
            <AppIcon
              name={detailExpanded ? 'chevron.up' : 'chevron.down'}
              color={theme.textSecondary}
              size={16}
              fallback={detailExpanded ? '⌃' : '⌄'}
            />
          </Pressable>
          {detailExpanded ? (
            <View
              style={{
                padding: appSpacing.md,
                paddingTop: 0,
                gap: appSpacing.sm,
              }}>
              <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
                編集する日付を選ぶと、勤務区分・時刻・メモをまとめて指定できます。
              </Text>
              <ActionButton
                label="日付を選んで詳しく入力"
                disabled={isReadOnly || isBusy}
                onPress={openDetailedEditor}
              />
            </View>
          ) : null}
        </View>

        <View
          style={{
            padding: appSpacing.md,
            gap: appSpacing.md,
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            backgroundColor: theme.hero,
            boxShadow: '0 12px 26px rgba(2, 6, 23, 0.20)',
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text selectable style={{ color: theme.heroText, fontSize: 19, fontWeight: '900' }}>
              下書き内容
            </Text>
            <View
              style={{
                paddingHorizontal: appSpacing.md,
                paddingVertical: 5,
                borderRadius: appRadii.pill,
                backgroundColor: period.submittedAt
                  ? 'rgba(16, 185, 129, 0.18)'
                  : 'rgba(255,255,255,0.10)',
              }}>
              <Text
                style={{
                  color: period.submittedAt ? theme.brandBright : theme.heroMuted,
                  fontSize: 11,
                  fontWeight: '900',
                }}>
                {draftStatus}
              </Text>
            </View>
          </View>
          {entered.length ? (
            <View
              style={{
                overflow: 'hidden',
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                backgroundColor: theme.heroRaised,
              }}>
              {entered.slice(0, 5).map((entry, index) => {
                const timeSlot = resolveTimeSlot(entry, period.timeSlots);
                return (
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
                      gap: appSpacing.md,
                      paddingHorizontal: appSpacing.md,
                      borderBottomWidth:
                        index === Math.min(entered.length, 5) - 1 ? 0 : 1,
                      borderBottomColor: 'rgba(255,255,255,0.08)',
                      opacity: pressed ? 0.55 : isReadOnly ? 0.7 : 1,
                    })}>
                    <TimeSlotIndicator timeSlot={timeSlot} />
                    <Text
                      selectable
                      style={{
                        width: 72,
                        color: theme.heroText,
                        fontSize: 12,
                        fontWeight: '800',
                      }}>
                      {formatDateLabel(`${entry.workDate}T00:00:00+09:00`, {
                        month: 'numeric',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </Text>
                    <Text
                      selectable
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: theme.heroMuted,
                        fontSize: 12,
                        fontWeight: '700',
                      }}>
                      {describeEntry(entry)}
                    </Text>
                  </Pressable>
                );
              })}
              {entered.length > 5 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setViewMode('list')}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.55 : 1,
                  })}>
                  <Text style={{ color: theme.brandBright, fontSize: 12, fontWeight: '900' }}>
                    残り{entered.length - 5}件をリストで確認
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View
              style={{
                padding: appSpacing.md,
                gap: appSpacing.xs,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                backgroundColor: theme.heroRaised,
              }}>
              <Text selectable style={{ color: theme.heroMuted, fontSize: 14, fontWeight: '900' }}>
                まだ提出内容がありません。
              </Text>
              <Text selectable style={{ color: theme.heroMuted, fontSize: 12 }}>
                上のカレンダーから希望を追加してください。
              </Text>
            </View>
          )}

          {!period.submittedAt && !deadlinePassed ? (
            <ActionButton
              label={save.isPending ? '保存中…' : isDirty ? '下書きを保存' : '下書きは保存済み'}
              disabled={isBusy || !isDirty}
              onPress={() => void handleSave()}
            />
          ) : null}
          {period.submittedAt ? (
            <ActionButton
              label={setSubmitted.isPending ? '更新中…' : '下書きに戻して修正'}
              variant="outlinedLight"
              disabled={isBusy || deadlinePassed}
              onPress={confirmReturnToDraft}
            />
          ) : null}
        </View>
      </AppScreen>

      {editingDate ? (
        <ShiftRequestEntrySheet
          key={editingDate}
          date={editingDate}
          entry={values[editingDate]}
          defaultBrush={resolveBrushForDate(mobilePreferences, editingDate, brush)}
          timeSlots={period.timeSlots}
          useTimeSlots={period.useTimeSlots}
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

function StepProgress({ current }: { current: 1 | 2 | 3 }) {
  const theme = useAppTheme();
  const steps = [
    { value: 1 as const, label: 'シフトを作成' },
    { value: 2 as const, label: '内容を確認' },
    { value: 3 as const, label: '提出完了' },
  ];
  return (
    <View
      accessibilityLabel={`提出手順 ${current}/3`}
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {steps.map((step, index) => {
        const active = current >= step.value;
        return (
          <View
            key={step.value}
            style={{
              minWidth: 0,
              flex: 1,
              alignItems: 'center',
              gap: 5,
            }}>
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <View
                style={{
                  height: 2,
                  flex: 1,
                  backgroundColor:
                    index === 0
                      ? 'transparent'
                      : current >= step.value
                        ? theme.brand
                        : theme.borderSoft,
                }}
              />
              <View
                style={{
                  width: 38,
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: appRadii.pill,
                  borderWidth: 3,
                  borderColor: active ? theme.brandSoft : theme.borderSoft,
                  backgroundColor: active ? theme.brand : theme.surface,
                }}>
                <Text
                  style={{
                    color: active ? '#FFFFFF' : theme.textSecondary,
                    fontSize: 14,
                    fontWeight: '900',
                    fontVariant: ['tabular-nums'],
                  }}>
                  {step.value}
                </Text>
              </View>
              <View
                style={{
                  height: 2,
                  flex: 1,
                  backgroundColor:
                    index === steps.length - 1
                      ? 'transparent'
                      : current > step.value
                        ? theme.brand
                        : theme.borderSoft,
                }}
              />
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                color: active ? theme.text : theme.textSecondary,
                fontSize: 10,
                fontWeight: '900',
              }}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ViewModeTab({
  selected,
  icon,
  label,
  onPress,
}: {
  selected: boolean;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderTopWidth: selected ? 4 : 0,
        borderTopColor: theme.brand,
        borderBottomWidth: 1,
        borderBottomColor: selected ? theme.brand : theme.borderSoft,
        backgroundColor: selected ? theme.surface : theme.surfaceMuted,
        opacity: pressed ? 0.65 : 1,
      })}>
      <AppIcon
        name={icon}
        color={selected ? theme.brandStrong : theme.textSecondary}
        size={19}
        fallback="•"
      />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={{
          color: selected ? theme.brandStrong : theme.textSecondary,
          fontSize: 15,
          fontWeight: '900',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function EntryList({
  entries,
  timeSlots,
  disabled,
  onEdit,
}: {
  entries: ShiftRequestDraftEntry[];
  timeSlots: ShiftTimeSlot[];
  disabled: boolean;
  onEdit: (date: string) => void;
}) {
  const theme = useAppTheme();
  if (!entries.length) {
    return (
      <View
        style={{
          minHeight: 108,
          alignItems: 'center',
          justifyContent: 'center',
          gap: appSpacing.xs,
          padding: appSpacing.md,
          borderRadius: appRadii.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.border,
        }}>
        <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
          まだ希望が追加されていません
        </Text>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center' }}>
          カレンダーへ切り替えて、勤務可能・優先希望・NGを入力してください。
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.borderSoft,
      }}>
      {entries.map((entry, index) => {
        const timeSlot = resolveTimeSlot(entry, timeSlots);
        return (
          <Pressable
            key={entry.workDate}
            accessibilityRole="button"
            accessibilityLabel={`${entry.workDate} ${describeEntry(entry)}を編集`}
            disabled={disabled}
            onPress={() => onEdit(entry.workDate)}
            style={({ pressed }) => ({
              minHeight: 58,
              flexDirection: 'row',
              alignItems: 'center',
              gap: appSpacing.md,
              paddingHorizontal: appSpacing.md,
              borderBottomWidth: index === entries.length - 1 ? 0 : 1,
              borderBottomColor: theme.borderSoft,
              backgroundColor: theme.surface,
              opacity: disabled ? 0.7 : pressed ? 0.6 : 1,
            })}>
            <TimeSlotIndicator timeSlot={timeSlot} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>
                {formatDateLabel(`${entry.workDate}T00:00:00+09:00`, {
                  month: 'numeric',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </Text>
              {entry.note ? (
                <Text
                  selectable
                  numberOfLines={1}
                  style={{ color: theme.textSecondary, fontSize: 10 }}>
                  {entry.note}
                </Text>
              ) : null}
            </View>
            <Text
              selectable
              numberOfLines={1}
              style={{
                maxWidth: '48%',
                color: theme.textSecondary,
                fontSize: 11,
                fontWeight: '800',
              }}>
              {describeEntry(entry)}
            </Text>
            {!disabled ? (
              <AppIcon name="chevron.right" color={theme.textSecondary} size={14} fallback="›" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function TimeSlotIndicator({
  timeSlot,
}: {
  timeSlot: ReturnType<typeof resolveTimeSlot>;
}) {
  if (!timeSlot) return null;
  const palette = timeSlotPalette(timeSlot.color);
  return (
    <View
      accessibilityLabel={`勤務時間帯 ${timeSlot.name}`}
      style={{
        width: 7,
        alignSelf: 'stretch',
        marginVertical: 8,
        borderRadius: appRadii.pill,
        backgroundColor: palette.base,
      }}
    />
  );
}

function SummaryCard({
  startDate,
  endDate,
  workDays,
  minutes,
  restDays,
  onViewDetails,
}: {
  startDate: string;
  endDate: string;
  workDays: number;
  minutes: number;
  restDays: number;
  onViewDetails: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        padding: appSpacing.md,
        gap: appSpacing.md,
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.borderSoft,
        backgroundColor: theme.surface,
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: appSpacing.md,
        }}>
        <Text selectable style={{ flex: 1, color: theme.text, fontSize: 17, fontWeight: '900' }}>
          シフト集計（{formatShortRange(startDate, endDate)}）
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onViewDetails}
          style={({ pressed }) => ({
            minHeight: 38,
            justifyContent: 'center',
            paddingHorizontal: 10,
            borderRadius: appRadii.sm,
            backgroundColor: theme.borderSoft,
            opacity: pressed ? 0.65 : 1,
          })}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>
            詳細を見る
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <SummaryMetric
          icon="calendar"
          color={theme.brandStrong}
          background={theme.brandSoft}
          label="勤務日数"
          value={`${workDays}日`}
        />
        <SummaryMetric
          icon="clock"
          color="#2563EB"
          background="#DBEAFE"
          label="合計時間（目安）"
          value={formatMinutes(minutes)}
          bordered
        />
        <SummaryMetric
          icon="moon"
          color="#D97706"
          background="#FEF3C7"
          label="休み"
          value={`${restDays}日`}
        />
      </View>
    </View>
  );
}

function SummaryMetric({
  icon,
  color,
  background,
  label,
  value,
  bordered = false,
}: {
  icon: string;
  color: string;
  background: string;
  label: string;
  value: string;
  bordered?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minWidth: 0,
        flex: 1,
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 5,
        borderLeftWidth: bordered ? 1 : 0,
        borderRightWidth: bordered ? 1 : 0,
        borderColor: theme.borderSoft,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: appRadii.pill,
          backgroundColor: background,
        }}>
        <AppIcon name={icon} color={color} size={17} fallback="•" />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          color: theme.text,
          fontSize: 14,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  variant = 'filled',
  disabled = false,
  grow = false,
  onPress,
}: {
  label: string;
  variant?: 'filled' | 'outlined' | 'outlinedLight';
  disabled?: boolean;
  grow?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const filled = variant === 'filled';
  const light = variant === 'outlinedLight';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => ({
        minWidth: 0,
        minHeight: 48,
        flex: grow ? 1 : undefined,
        alignSelf: grow ? undefined : 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        borderWidth: filled ? 0 : 1,
        borderColor: light ? 'rgba(255,255,255,0.55)' : theme.text,
        backgroundColor: filled
          ? theme.brand
          : light
            ? 'rgba(255,255,255,0.08)'
            : theme.surface,
        opacity: disabled ? 0.42 : pressed ? 0.68 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
        boxShadow: filled ? '0 7px 18px rgba(5, 150, 105, 0.18)' : undefined,
      })}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={{
          color: filled || light ? '#FFFFFF' : theme.text,
          fontSize: 15,
          fontWeight: '900',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function AppIcon({
  name,
  color,
  size,
  fallback,
}: {
  name: string;
  color: string;
  size: number;
  fallback: string;
}) {
  if (process.env.EXPO_OS !== 'ios') {
    return <Text style={{ color, fontSize: size, fontWeight: '900' }}>{fallback}</Text>;
  }
  return (
    <Image
      source={`sf:${name}`}
      tintColor={color}
      contentFit="contain"
      style={{ width: size, height: size }}
    />
  );
}

function summarizeEntries(entries: ShiftRequestDraftEntry[]) {
  let workDays = 0;
  let restDays = 0;
  let minutes = 0;
  for (const entry of entries) {
    if (entry.entryType === 'unavailable') {
      restDays += 1;
      continue;
    }
    workDays += 1;
    if (!entry.isAllDay && isValidTime(entry.startTime) && isValidTime(entry.endTime)) {
      const [startHour, startMinute] = entry.startTime.split(':').map(Number);
      const [endHour, endMinute] = entry.endTime.split(':').map(Number);
      const start = startHour * 60 + startMinute;
      let end = endHour * 60 + endMinute;
      if (end <= start) end += 24 * 60;
      minutes += end - start;
    }
  }
  return { workDays, restDays, minutes };
}

function formatFullDateRange(startDate: string, endDate: string) {
  const start = formatDateKey(startDate, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  const end = formatDateKey(endDate, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  return `${start} ～ ${end}`;
}

function formatShortRange(startDate: string, endDate: string) {
  return `${Number(startDate.slice(5, 7))}/${Number(startDate.slice(8, 10))} ～ ${Number(endDate.slice(5, 7))}/${Number(endDate.slice(8, 10))}`;
}

function formatDateKey(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    ...options,
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatDeadline(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
}
