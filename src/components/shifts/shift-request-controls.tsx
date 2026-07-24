import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import type { ShiftRequestBrush } from '@/features/shift-request/draft';
import type { ShiftTimeSlot } from '@/features/staff/types';

type Props = {
  brush: ShiftRequestBrush;
  useTimeSlots: boolean;
  timeSlots: ShiftTimeSlot[];
  dragEnabled: boolean;
  disabled: boolean;
  onBrushChange: (brush: ShiftRequestBrush) => void;
  onDragEnabledChange: (enabled: boolean) => void;
  onFillUnentered: () => void;
  onCopyPreviousWeek: () => void;
  onClearAll: () => void;
};

function ChoiceButton({
  active,
  disabled,
  label,
  color,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: appSpacing.sm,
        borderWidth: active ? 2 : 1,
        borderColor: active ? color : theme.border,
        borderRadius: appRadii.sm,
        borderCurve: 'continuous',
        backgroundColor: active ? color : theme.surface,
        opacity: disabled ? 0.45 : pressed ? 0.68 : 1,
      })}>
      <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 13, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function QuickButton({
  label,
  disabled,
  destructive = false,
  onPress,
}: {
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderWidth: 1,
        borderColor: destructive ? theme.danger : theme.border,
        borderRadius: appRadii.pill,
        backgroundColor: destructive ? theme.dangerSoft : theme.surface,
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
      })}>
      <Text
        style={{
          color: destructive ? theme.danger : theme.text,
          fontSize: 12,
          fontWeight: '700',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ShiftRequestControls({
  brush,
  useTimeSlots,
  timeSlots,
  dragEnabled,
  disabled,
  onBrushChange,
  onDragEnabledChange,
  onFillUnentered,
  onCopyPreviousWeek,
  onClearAll,
}: Props) {
  const theme = useAppTheme();
  const update = (patch: Partial<ShiftRequestBrush>) => onBrushChange({ ...brush, ...patch });

  return (
    <View style={{ gap: appSpacing.md }}>
      <View style={{ gap: appSpacing.sm }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>入力ブラシ</Text>
        <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
          <ChoiceButton
            active={brush.entryType === 'available'}
            disabled={disabled}
            label="勤務可"
            color={theme.brand}
            onPress={() => update({ entryType: 'available' })}
          />
          <ChoiceButton
            active={brush.entryType === 'preferred'}
            disabled={disabled}
            label="優先希望"
            color={theme.warning}
            onPress={() => update({ entryType: 'preferred' })}
          />
          <ChoiceButton
            active={brush.entryType === 'unavailable'}
            disabled={disabled}
            label="NG"
            color={theme.danger}
            onPress={() =>
              update({
                entryType: 'unavailable',
                isAllDay: true,
                timeSlotId: null,
              })
            }
          />
        </View>
      </View>

      {brush.entryType !== 'unavailable' ? (
        <View style={{ gap: appSpacing.sm }}>
          <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
            <ChoiceButton
              active={brush.isAllDay}
              disabled={disabled}
              label="終日"
              color={theme.hero}
              onPress={() => update({ isAllDay: true, timeSlotId: null })}
            />
            <ChoiceButton
              active={!brush.isAllDay}
              disabled={disabled}
              label="時間指定"
              color={theme.hero}
              onPress={() => update({ isAllDay: false })}
            />
          </View>

          {!brush.isAllDay ? (
            <>
              {timeSlots.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: appSpacing.sm }}>
                  {timeSlots.map((slot) => {
                    const selected =
                      brush.startTime === slot.startTime &&
                      brush.endTime === slot.endTime &&
                      (!useTimeSlots || brush.timeSlotId === slot.id);
                    return (
                      <Pressable
                        key={slot.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${slot.name} ${slot.startTime}から${slot.endTime}`}
                        accessibilityState={{ disabled, selected }}
                        disabled={disabled}
                        onPress={() =>
                          update({
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            timeSlotId: useTimeSlots ? slot.id : null,
                          })
                        }
                        style={({ pressed }) => ({
                          minHeight: 44,
                          justifyContent: 'center',
                          paddingHorizontal: appSpacing.md,
                          borderRadius: appRadii.pill,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? theme.brand : theme.border,
                          backgroundColor: selected ? theme.brandSoft : theme.surface,
                          opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
                        })}>
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>
                          {slot.shortLabel} {slot.startTime}–{slot.endTime}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
                <TimeInput
                  label="開始"
                  value={brush.startTime}
                  disabled={disabled}
                  onChangeText={(startTime) => update({ startTime, timeSlotId: null })}
                />
                <Text style={{ color: theme.textSecondary }}>–</Text>
                <TimeInput
                  label="終了"
                  value={brush.endTime}
                  disabled={disabled}
                  onChangeText={(endTime) => update({ endTime, timeSlotId: null })}
                />
              </View>
              {brush.endTime <= brush.startTime ? (
                <Text style={{ color: theme.info, fontSize: 12, fontWeight: '600' }}>
                  終了が開始以前のため、翌日の終了時刻として保存します。
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          NGは誤解を防ぐため終日固定です。
        </Text>
      )}

      <View
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: appSpacing.md,
          paddingHorizontal: appSpacing.md,
          borderRadius: appRadii.md,
          backgroundColor: theme.surfaceMuted,
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
            {dragEnabled ? 'なぞり入力' : 'タップ入力'}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
            {dragEnabled
              ? '指を離すまでプレビューし、キャンセル時は反映しません'
              : '同じブラシをもう一度タップすると削除します'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: dragEnabled, disabled }}
          disabled={disabled}
          onPress={() => onDragEnabledChange(!dragEnabled)}
          style={({ pressed }) => ({
            minWidth: 92,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: appRadii.pill,
            backgroundColor: dragEnabled ? theme.brand : theme.surface,
            borderWidth: 1,
            borderColor: dragEnabled ? theme.brand : theme.border,
            opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
          })}>
          <Text
            style={{
              color: dragEnabled ? '#FFFFFF' : theme.text,
              fontSize: 12,
              fontWeight: '800',
            }}>
            {dragEnabled ? 'なぞり ON' : 'タップ'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
        <QuickButton label="未入力を一括入力" disabled={disabled} onPress={onFillUnentered} />
        <QuickButton label="前週をコピー" disabled={disabled} onPress={onCopyPreviousWeek} />
        <QuickButton
          label="全削除"
          disabled={disabled}
          destructive
          onPress={onClearAll}
        />
      </View>
    </View>
  );
}

function TimeInput({
  label,
  value,
  disabled,
  onChangeText,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChangeText: (value: string) => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minHeight: 52,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: appRadii.sm,
        backgroundColor: theme.surface,
      }}>
      <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '700' }}>{label}</Text>
      <TextInput
        accessibilityLabel={`${label}時刻`}
        value={value}
        editable={!disabled}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
        selectTextOnFocus
        onChangeText={onChangeText}
        placeholder="09:00"
        placeholderTextColor={theme.textSecondary}
        style={{
          minHeight: 30,
          padding: 0,
          color: theme.text,
          fontSize: 17,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}
