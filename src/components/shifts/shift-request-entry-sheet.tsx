import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NativeActionButton } from '@/components/ui/native-action-button';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import type {
  ShiftRequestBrush,
  ShiftRequestDraftEntry,
} from '@/features/shift-request/draft';
import { formatDateLabel } from '@/features/staff/date';

type Props = {
  date: string | null;
  entry: ShiftRequestDraftEntry | undefined;
  defaultBrush: ShiftRequestBrush;
  onClose: () => void;
  onSave: (entry: ShiftRequestDraftEntry) => void;
  onDelete: () => void;
};

const entryTypes: {
  value: ShiftRequestDraftEntry['entryType'];
  label: string;
}[] = [
  { value: 'available', label: '勤務可' },
  { value: 'preferred', label: '優先希望' },
  { value: 'unavailable', label: 'NG' },
];

export function ShiftRequestEntrySheet({
  date,
  entry,
  defaultBrush,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const theme = useAppTheme();
  const [draft, setDraft] = useState<ShiftRequestDraftEntry>(() =>
    entry ?? {
      workDate: date!,
      ...defaultBrush,
      note: '',
    },
  );

  if (!date) return null;

  const update = (patch: Partial<ShiftRequestDraftEntry>) =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            padding: appSpacing.lg,
            gap: appSpacing.lg,
          }}>
          <View style={{ gap: appSpacing.xs }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>
              1日を詳しく編集
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              {formatDateLabel(`${date}T00:00:00+09:00`, {
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
            {entryTypes.map((option) => {
              const selected = draft.entryType === option.value;
              const selectedColor =
                option.value === 'available'
                  ? theme.brand
                  : option.value === 'preferred'
                    ? theme.warning
                    : theme.danger;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    update({
                      entryType: option.value,
                      ...(option.value === 'unavailable'
                        ? { isAllDay: true, timeSlotId: null }
                        : {}),
                    })
                  }
                  style={({ pressed }) => ({
                    minHeight: 48,
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: appRadii.sm,
                    backgroundColor: selected ? selectedColor : theme.surface,
                    borderWidth: 1,
                    borderColor: selected ? selectedColor : theme.border,
                    opacity: pressed ? 0.65 : 1,
                  })}>
                  <Text
                    style={{
                      color: selected ? '#FFFFFF' : theme.text,
                      fontSize: 13,
                      fontWeight: '800',
                    }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {draft.entryType !== 'unavailable' ? (
            <View style={{ gap: appSpacing.md }}>
              <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
                {[
                  { value: true, label: '終日' },
                  { value: false, label: '時間指定' },
                ].map((option) => (
                  <Pressable
                    key={String(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draft.isAllDay === option.value }}
                    onPress={() =>
                      update({
                        isAllDay: option.value,
                        ...(option.value ? { timeSlotId: null } : {}),
                      })
                    }
                    style={({ pressed }) => ({
                      minHeight: 48,
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: appRadii.sm,
                      borderWidth: 1,
                      borderColor:
                        draft.isAllDay === option.value ? theme.hero : theme.border,
                      backgroundColor:
                        draft.isAllDay === option.value ? theme.hero : theme.surface,
                      opacity: pressed ? 0.65 : 1,
                    })}>
                    <Text
                      style={{
                        color:
                          draft.isAllDay === option.value ? '#FFFFFF' : theme.text,
                        fontWeight: '800',
                      }}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!draft.isAllDay ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
                  <TimeField
                    label="開始"
                    value={draft.startTime}
                    onChange={(startTime) => update({ startTime, timeSlotId: null })}
                  />
                  <Text style={{ color: theme.textSecondary }}>–</Text>
                  <TimeField
                    label="終了"
                    value={draft.endTime}
                    onChange={(endTime) => update({ endTime, timeSlotId: null })}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>NGは終日固定です。</Text>
          )}

          <View style={{ gap: appSpacing.xs }}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              メモ（任意）
            </Text>
            <TextInput
              value={draft.note}
              onChangeText={(note) => update({ note })}
              maxLength={400}
              multiline
              textAlignVertical="top"
              placeholder="例：17時以降を希望"
              placeholderTextColor={theme.textSecondary}
              style={{
                minHeight: 112,
                padding: appSpacing.md,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: appRadii.md,
                backgroundColor: theme.surface,
                color: theme.text,
                fontSize: 16,
              }}
            />
            <Text
              style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'right' }}>
              {draft.note.length}/400
            </Text>
          </View>

          <View style={{ flex: 1 }} />
          <NativeActionButton label="この内容を反映" onPress={() => onSave(draft)} />
          {entry ? (
            <NativeActionButton
              label="この日の入力を削除"
              variant="outlined"
              tone="danger"
              onPress={onDelete}
            />
          ) : null}
          <NativeActionButton label="キャンセル" variant="text" onPress={onClose} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: appSpacing.md,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: appRadii.sm,
        backgroundColor: theme.surface,
      }}>
      <Text style={{ paddingTop: appSpacing.sm, color: theme.textSecondary, fontSize: 11 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={`${label}時刻`}
        value={value}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
        selectTextOnFocus
        onChangeText={onChange}
        style={{
          minHeight: 42,
          paddingVertical: 0,
          color: theme.text,
          fontSize: 18,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}
