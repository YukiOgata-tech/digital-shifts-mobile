import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { PageIntro } from '@/components/ui/page-intro';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  useAddShiftAdjustmentEntry,
  useDeleteShiftAdjustmentEntry,
  useShiftAdjustmentWindows,
  useSubmitShiftAdjustmentWindow,
} from '@/features/staff/queries';
import { formatDateLabel, formatDateTime, formatTime } from '@/features/staff/date';
import type {
  ShiftAdjustmentRequestType,
  ShiftAdjustmentWindow,
  ShiftAssignment,
} from '@/features/staff/types';

const requestTypes: {
  value: ShiftAdjustmentRequestType;
  label: string;
  description: string;
}[] = [
  {
    value: 'change_time',
    label: '時間変更',
    description: '現在の勤務時間を変更したい',
  },
  {
    value: 'unavailable',
    label: '勤務不可',
    description: 'この日は勤務できない',
  },
  {
    value: 'available',
    label: '勤務可能',
    description: '指定時間なら勤務できる',
  },
  {
    value: 'note',
    label: 'メモ',
    description: '管理者へ相談内容だけ送る',
  },
];

function statusMeta(status: ShiftAdjustmentWindow['status']) {
  if (status === 'open') return { label: '受付中', tone: 'info' as const };
  if (status === 'submitted') return { label: '提出済み', tone: 'brand' as const };
  if (status === 'reviewed') return { label: '確認済み', tone: 'warning' as const };
  if (status === 'applied') return { label: '反映済み', tone: 'brand' as const };
  if (status === 'closed') return { label: '受付終了', tone: 'neutral' as const };
  return { label: '取消', tone: 'danger' as const };
}

function toTimeInput(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function ShiftAdjustmentScreen() {
  const { windowId } = useLocalSearchParams<{ windowId?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const windows = useShiftAdjustmentWindows();
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(
    windowId ?? null,
  );

  const selectedWindow = useMemo(() => {
    const items = windows.data ?? [];
    return (
      items.find((item) => item.id === selectedWindowId) ??
      items.find((item) => item.id === windowId) ??
      items.find((item) => item.status === 'open') ??
      items.find((item) => item.status === 'submitted') ??
      items[0] ??
      null
    );
  }, [selectedWindowId, windowId, windows.data]);

  if (windows.isLoading) {
    return (
      <AppScreen>
        <LoadingState />
      </AppScreen>
    );
  }

  if (windows.isError) {
    return (
      <AppScreen>
        <ErrorState
          message={windows.error.message}
          onRetry={() => void windows.refetch()}
        />
      </AppScreen>
    );
  }

  if (!selectedWindow) {
    return (
      <AppScreen>
        <EmptyState
          title="修正希望の受付はありません"
          description="管理者が対象シフトの修正希望受付を開始すると、ここから相談内容を提出できます。"
        />
        <NativeActionButton label="戻る" variant="text" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      contentContainerStyle={{ justifyContent: 'flex-start' }}
      refreshing={windows.isFetching}
      onRefresh={() => void windows.refetch()}>
      <PageIntro
        eyebrow="Shift adjustment"
        title="シフト修正希望"
        description="公開されたシフトを確認し、変更したい内容を管理者へ提出します。提出だけでは確定シフトは変更されません。"
      />

      {(windows.data?.length ?? 0) > 1 ? (
        <View style={{ gap: appSpacing.sm }}>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
            受付を選択
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
            {windows.data?.map((item) => {
              const selected = item.id === selectedWindow.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedWindowId(item.id)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: appSpacing.md,
                    borderRadius: appRadii.pill,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? theme.info : theme.border,
                    backgroundColor: selected ? theme.infoSoft : theme.surface,
                    opacity: pressed ? 0.65 : 1,
                  })}>
                  <Text
                    style={{
                      color: selected ? theme.info : theme.text,
                      fontSize: 12,
                      fontWeight: '800',
                    }}>
                    {item.storeName} · {item.periodName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <AdjustmentWindowEditor key={selectedWindow.id} window={selectedWindow} />

      <NativeActionButton label="戻る" variant="text" onPress={() => router.back()} />
    </AppScreen>
  );
}

function AdjustmentWindowEditor({ window }: { window: ShiftAdjustmentWindow }) {
  const theme = useAppTheme();
  const addEntry = useAddShiftAdjustmentEntry();
  const deleteEntry = useDeleteShiftAdjustmentEntry();
  const submitWindow = useSubmitShiftAdjustmentWindow();
  const firstAssignment = window.assignments[0] ?? null;
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    firstAssignment?.id ?? '',
  );
  const [workDate, setWorkDate] = useState(
    firstAssignment?.workDate ?? window.periodStartDate,
  );
  const [requestType, setRequestType] =
    useState<ShiftAdjustmentRequestType>('change_time');
  const [startTime, setStartTime] = useState(
    firstAssignment ? toTimeInput(firstAssignment.startAt) : '09:00',
  );
  const [endTime, setEndTime] = useState(
    firstAssignment ? toTimeInput(firstAssignment.endAt) : '18:00',
  );
  const [note, setNote] = useState('');
  const meta = statusMeta(window.status);
  const editable = window.status === 'open';
  const busy = addEntry.isPending || deleteEntry.isPending || submitWindow.isPending;
  const needsTime = requestType === 'change_time' || requestType === 'available';

  const selectAssignment = (assignment: ShiftAssignment | null) => {
    setSelectedAssignmentId(assignment?.id ?? '');
    if (!assignment) return;
    setWorkDate(assignment.workDate);
    setStartTime(toTimeInput(assignment.startAt));
    setEndTime(toTimeInput(assignment.endAt));
  };

  const handleAdd = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      Alert.alert('対象日を確認してください', '2026-07-25の形式で入力してください。');
      return;
    }
    if (workDate < window.periodStartDate || workDate > window.periodEndDate) {
      Alert.alert(
        '対象日を確認してください',
        `${window.periodStartDate}〜${window.periodEndDate}の日付を入力してください。`,
      );
      return;
    }
    if (
      needsTime &&
      (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))
    ) {
      Alert.alert('希望時刻を確認してください', '00:00〜23:59の形式で入力してください。');
      return;
    }
    if (requestType === 'note' && !note.trim()) {
      Alert.alert('メモを入力してください');
      return;
    }

    try {
      await addEntry.mutateAsync({
        window,
        assignmentId: selectedAssignmentId || null,
        workDate,
        requestType,
        desiredStartTime: needsTime ? startTime : undefined,
        desiredEndTime: needsTime ? endTime : undefined,
        note,
      });
      setNote('');
      Alert.alert('追加しました', '提出予定の修正希望に追加しました。');
    } catch (error) {
      Alert.alert(
        '追加できませんでした',
        error instanceof Error ? error.message : '通信状態を確認してください。',
      );
    }
  };

  const handleDelete = (entryId: string) => {
    Alert.alert('この修正希望を削除しますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void deleteEntry
            .mutateAsync({ id: entryId, windowId: window.id })
            .catch((error: Error) =>
              Alert.alert('削除できませんでした', error.message),
            );
        },
      },
    ]);
  };

  const handleSubmit = () => {
    if (!window.entries.length) {
      Alert.alert('提出する修正希望がありません');
      return;
    }
    Alert.alert(
      'シフト修正希望を提出しますか？',
      'この提出だけではシフトは変更されません。管理者が確認し、必要に応じてシフトを編集します。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '提出する',
          onPress: () => {
            void submitWindow
              .mutateAsync(window.id)
              .then(() => Alert.alert('提出しました'))
              .catch((error: Error) =>
                Alert.alert('提出できませんでした', error.message),
              );
          },
        },
      ],
    );
  };

  return (
    <>
      <SectionCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: appSpacing.md,
          }}>
          <View style={{ flex: 1, gap: appSpacing.xs }}>
            <Text selectable style={{ color: theme.text, fontSize: 19, fontWeight: '800' }}>
              {window.periodName}
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              {window.storeName}
            </Text>
          </View>
          <StatusPill label={meta.label} tone={meta.tone} />
        </View>
        {window.reason ? (
          <View
            style={{
              padding: appSpacing.md,
              borderRadius: appRadii.md,
              backgroundColor: theme.infoSoft,
            }}>
            <Text selectable style={{ color: theme.info, fontSize: 13, lineHeight: 19 }}>
              {window.reason}
            </Text>
          </View>
        ) : null}
        <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
          受付開始 {formatDateTime(window.openedAt)}
          {window.dueAt ? ` · 期限 ${formatDateTime(window.dueAt)}` : ''}
        </Text>
      </SectionCard>

      <SectionCard>
        <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
          現在のシフト
        </Text>
        {window.assignments.length ? (
          <View style={{ gap: appSpacing.sm }}>
            {window.assignments.map((assignment) => (
              <View
                key={assignment.id}
                style={{
                  minHeight: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: appSpacing.md,
                  paddingHorizontal: appSpacing.md,
                  borderRadius: appRadii.sm,
                  backgroundColor: theme.surfaceMuted,
                }}>
                <Text selectable style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                  {formatDateLabel(`${assignment.workDate}T00:00:00+09:00`)}
                </Text>
                <Text
                  selectable
                  style={{
                    color: theme.text,
                    fontSize: 14,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}>
                  {formatTime(assignment.startAt)}–{formatTime(assignment.endAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            現在の配置済みシフトはありません。
          </Text>
        )}
      </SectionCard>

      {editable ? (
        <SectionCard>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
            修正希望を追加
          </Text>

          <FieldLabel label="対象シフト">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
              <SelectChip
                label="未配置日・その他"
                selected={!selectedAssignmentId}
                disabled={busy}
                onPress={() => selectAssignment(null)}
              />
              {window.assignments.map((assignment) => (
                <SelectChip
                  key={assignment.id}
                  label={`${formatDateLabel(`${assignment.workDate}T00:00:00+09:00`, {
                    month: 'numeric',
                    day: 'numeric',
                  })} ${formatTime(assignment.startAt)}–${formatTime(assignment.endAt)}`}
                  selected={selectedAssignmentId === assignment.id}
                  disabled={busy}
                  onPress={() => selectAssignment(assignment)}
                />
              ))}
            </View>
          </FieldLabel>

          <FieldLabel label="対象日">
            <FormTextInput
              accessibilityLabel="修正希望の対象日"
              value={workDate}
              editable={!busy}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              placeholder="2026-07-25"
              onChangeText={setWorkDate}
            />
            <Text selectable style={{ color: theme.textSecondary, fontSize: 11 }}>
              対象期間 {window.periodStartDate}〜{window.periodEndDate}
            </Text>
          </FieldLabel>

          <FieldLabel label="希望内容">
            <View style={{ gap: appSpacing.sm }}>
              {requestTypes.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: busy,
                    selected: requestType === option.value,
                  }}
                  disabled={busy}
                  onPress={() => setRequestType(option.value)}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: appSpacing.md,
                    paddingHorizontal: appSpacing.md,
                    borderRadius: appRadii.md,
                    borderWidth: requestType === option.value ? 2 : 1,
                    borderColor:
                      requestType === option.value ? theme.info : theme.border,
                    backgroundColor:
                      requestType === option.value ? theme.infoSoft : theme.surface,
                    opacity: pressed ? 0.65 : busy ? 0.5 : 1,
                  })}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: appRadii.pill,
                      borderWidth: 2,
                      borderColor:
                        requestType === option.value ? theme.info : theme.border,
                      backgroundColor:
                        requestType === option.value ? theme.info : 'transparent',
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
                      {option.label}
                    </Text>
                    <Text selectable style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </FieldLabel>

          {needsTime ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
              <FieldLabel label="希望開始" style={{ flex: 1 }}>
                <FormTextInput
                  accessibilityLabel="希望開始時刻"
                  value={startTime}
                  editable={!busy}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  placeholder="09:00"
                  onChangeText={setStartTime}
                />
              </FieldLabel>
              <Text style={{ color: theme.textSecondary, paddingTop: 24 }}>–</Text>
              <FieldLabel label="希望終了" style={{ flex: 1 }}>
                <FormTextInput
                  accessibilityLabel="希望終了時刻"
                  value={endTime}
                  editable={!busy}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  placeholder="18:00"
                  onChangeText={setEndTime}
                />
              </FieldLabel>
            </View>
          ) : null}

          <FieldLabel label={requestType === 'note' ? 'メモ（必須）' : 'メモ（任意）'}>
            <TextInput
              accessibilityLabel="管理者へのメモ"
              value={note}
              editable={!busy}
              maxLength={800}
              multiline
              textAlignVertical="top"
              placeholder="理由や相談内容を入力"
              placeholderTextColor={theme.textSecondary}
              onChangeText={setNote}
              style={{
                minHeight: 96,
                padding: appSpacing.md,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: appRadii.md,
                backgroundColor: theme.surface,
                color: theme.text,
                fontSize: 15,
              }}
            />
            <Text
              selectable
              style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'right' }}>
              {note.length}/800
            </Text>
          </FieldLabel>

          <NativeActionButton
            label={addEntry.isPending ? '追加中…' : '修正希望を追加'}
            disabled={busy}
            onPress={() => void handleAdd()}
          />
        </SectionCard>
      ) : (
        <View
          style={{
            padding: appSpacing.md,
            borderRadius: appRadii.md,
            backgroundColor: theme.surfaceMuted,
          }}>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
            この修正希望は提出済み、確認済み、または受付終了済みです。内容の変更が必要な場合は管理者へ相談してください。
          </Text>
        </View>
      )}

      <SectionCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
            {editable ? '提出予定の修正希望' : '提出内容'}
          </Text>
          <Text
            selectable
            style={{ color: theme.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>
            {window.entries.length}件
          </Text>
        </View>
        {window.entries.length ? (
          window.entries.map((entry) => {
            const type = requestTypes.find((item) => item.value === entry.requestType);
            const assignment = window.assignments.find(
              (item) => item.id === entry.assignmentId,
            );
            return (
              <View
                key={entry.id}
                style={{
                  padding: appSpacing.md,
                  gap: appSpacing.xs,
                  borderRadius: appRadii.md,
                  borderWidth: 1,
                  borderColor: theme.borderSoft,
                  backgroundColor: theme.surfaceMuted,
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: appSpacing.md,
                  }}>
                  <View style={{ flex: 1, gap: appSpacing.xs }}>
                    <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
                      {formatDateLabel(`${entry.workDate}T00:00:00+09:00`)} ·{' '}
                      {type?.label ?? '修正希望'}
                    </Text>
                    {assignment ? (
                      <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>
                        現在 {formatTime(assignment.startAt)}–{formatTime(assignment.endAt)}
                      </Text>
                    ) : null}
                    {entry.desiredStartAt && entry.desiredEndAt ? (
                      <Text selectable style={{ color: theme.info, fontSize: 12, fontWeight: '700' }}>
                        希望 {formatTime(entry.desiredStartAt)}–{formatTime(entry.desiredEndAt)}
                      </Text>
                    ) : null}
                    {entry.note ? (
                      <Text selectable style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
                        {entry.note}
                      </Text>
                    ) : null}
                  </View>
                  {editable ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="この修正希望を削除"
                      disabled={busy}
                      onPress={() => handleDelete(entry.id)}
                      style={({ pressed }) => ({
                        minWidth: 44,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: appRadii.pill,
                        backgroundColor: theme.dangerSoft,
                        opacity: pressed ? 0.65 : busy ? 0.5 : 1,
                      })}>
                      <Text style={{ color: theme.danger, fontSize: 12, fontWeight: '800' }}>
                        削除
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            まだ修正希望は追加されていません。
          </Text>
        )}
      </SectionCard>

      {editable ? (
        <NativeActionButton
          label={submitWindow.isPending ? '提出中…' : '修正希望を提出'}
          disabled={busy || !window.entries.length}
          haptic="success"
          onPress={handleSubmit}
        />
      ) : null}
    </>
  );
}

function FieldLabel({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: { flex: number };
}) {
  const theme = useAppTheme();
  return (
    <View style={[{ gap: appSpacing.xs }, style]}>
      <Text selectable style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function FormTextInput(props: ComponentProps<typeof TextInput>) {
  const theme = useAppTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.textSecondary}
      style={[
        {
          minHeight: 48,
          paddingHorizontal: appSpacing.md,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: appRadii.sm,
          backgroundColor: theme.surface,
          color: theme.text,
          fontSize: 16,
          fontVariant: ['tabular-nums'],
        },
        props.style,
      ]}
    />
  );
}

function SelectChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.info : theme.border,
        borderRadius: appRadii.pill,
        backgroundColor: selected ? theme.infoSoft : theme.surface,
        opacity: pressed ? 0.65 : disabled ? 0.5 : 1,
      })}>
      <Text
        selectable
        style={{
          color: selected ? theme.info : theme.text,
          fontSize: 12,
          fontWeight: '700',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
