import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import type { ShiftRequestBrush } from '@/features/shift-request/draft';
import {
  resolveTimeSlot,
  timeSlotPalette,
} from '@/features/shift-request/time-slot-colors';
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
  const update = (patch: Partial<ShiftRequestBrush>) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onBrushChange({ ...brush, ...patch });
  };
  const brushSummary = describeBrush(brush, timeSlots);
  const selectedTimeSlot = resolveTimeSlot(brush, timeSlots);

  return (
    <View
      style={{
        paddingHorizontal: appSpacing.sm,
        paddingVertical: 10,
        gap: 7,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderSoft,
        backgroundColor: theme.surfaceMuted,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <AppIcon name="sparkles" color={theme.brandStrong} size={16} fallback="✦" />
        <Text
          selectable
          style={{ color: theme.brandStrong, fontSize: 13, fontWeight: '900' }}>
          かんたん入力：種類を選んで、日付をタップ
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
        <ChoiceButton
          active={brush.entryType === 'available'}
          disabled={disabled}
          label="勤務可能"
          activeColor={theme.brand}
          inactiveColor={theme.brandStrong}
          onPress={() => update({ entryType: 'available' })}
        />
        <ChoiceButton
          active={brush.entryType === 'preferred'}
          disabled={disabled}
          label="優先希望"
          activeColor="#F59E0B"
          inactiveColor={theme.warning}
          onPress={() => update({ entryType: 'preferred' })}
        />
        <ChoiceButton
          active={brush.entryType === 'unavailable'}
          disabled={disabled}
          label="NG（休み）"
          activeColor={theme.hero}
          inactiveColor={theme.textSecondary}
          onPress={() =>
            update({
              entryType: 'unavailable',
              isAllDay: true,
              timeSlotId: null,
            })
          }
        />
      </View>

      {brush.entryType !== 'unavailable' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
            <CompactChoice
              active={brush.isAllDay}
              disabled={disabled}
              label="終日"
              onPress={() => update({ isAllDay: true, timeSlotId: null })}
            />
            <CompactChoice
              active={!brush.isAllDay}
              disabled={disabled}
              label="時間を指定"
              onPress={() => update({ isAllDay: false })}
            />
          </View>

          {!brush.isAllDay ? (
            <>
              {timeSlots.length ? (
                <View style={{ gap: 5 }}>
                  <Text
                    selectable
                    style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>
                    店舗の勤務時間帯から選ぶ
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: appSpacing.sm }}>
                    {timeSlots.map((slot) => {
                      const selected = selectedTimeSlot?.id === slot.id;
                      const palette = timeSlotPalette(slot.color);
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
                            paddingHorizontal: 11,
                            paddingVertical: 5,
                            borderRadius: appRadii.sm,
                            borderCurve: 'continuous',
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? palette.base : palette.border,
                            backgroundColor: selected ? palette.base : palette.soft,
                            opacity: disabled ? 0.45 : pressed ? 0.68 : 1,
                            boxShadow: selected
                              ? `0 4px 12px ${palette.base}3D`
                              : undefined,
                          })}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}>
                            <View
                              accessibilityElementsHidden
                              importantForAccessibility="no-hide-descendants"
                              style={{
                                width: 9,
                                height: 9,
                                borderRadius: appRadii.pill,
                                backgroundColor: selected
                                  ? palette.onBase
                                  : palette.base,
                              }}
                            />
                            <View style={{ gap: 1 }}>
                              <Text
                                style={{
                                  color: selected ? palette.onBase : palette.onSoft,
                                  fontSize: 13,
                                  fontWeight: '900',
                                }}>
                                {slot.shortLabel}
                              </Text>
                              <Text
                                style={{
                                  color: selected ? palette.onBase : palette.onSoft,
                                  fontSize: 10,
                                  fontWeight: '800',
                                  fontVariant: ['tabular-nums'],
                                  opacity: selected ? 0.86 : 0.72,
                                }}>
                                {slot.startTime}-{slot.endTime}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
                <TimeInput
                  label="開始"
                  value={brush.startTime}
                  disabled={disabled}
                  onChangeText={(startTime) => update({ startTime, timeSlotId: null })}
                />
                <TimeInput
                  label="終了"
                  value={brush.endTime}
                  disabled={disabled}
                  onChangeText={(endTime) => update({ endTime, timeSlotId: null })}
                />
              </View>
              {brush.endTime <= brush.startTime ? (
                <Text selectable style={{ color: theme.info, fontSize: 11, fontWeight: '700' }}>
                  終了時刻は翌日として保存されます。
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <Text selectable style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
          NG（休み）は終日固定です。
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
        <QuickButton
          icon="sparkles"
          label={`未入力を「${brushSummary}」で埋める`}
          disabled={disabled}
          onPress={onFillUnentered}
        />
        <QuickButton
          icon="doc.on.doc"
          label="前の週をコピー"
          disabled={disabled}
          onPress={onCopyPreviousWeek}
        />
        <QuickButton
          icon="trash"
          label="すべて消去"
          disabled={disabled}
          destructive
          onPress={onClearAll}
        />
      </View>

      <View
        style={{
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 10,
          borderRadius: appRadii.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: theme.borderSoft,
          backgroundColor: theme.surface,
        }}>
        <AppIcon name="hand.draw" color={theme.textSecondary} size={20} fallback="☝" />
        <View style={{ flex: 1, gap: 1 }}>
          <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '900' }}>
            なぞって連続選択
          </Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
            {dragEnabled
              ? '指を離した時に複数日へまとめて反映'
              : '指でなぞって複数日をまとめて入力'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="なぞって連続選択"
          disabled={disabled}
          value={dragEnabled}
          onValueChange={(value) => {
            if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
            onDragEnabledChange(value);
          }}
          trackColor={{ false: theme.border, true: theme.brand }}
        />
      </View>
    </View>
  );
}

function ChoiceButton({
  active,
  disabled,
  label,
  activeColor,
  inactiveColor,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  activeColor: string;
  inactiveColor: string;
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
        minWidth: 0,
        minHeight: 44,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: active ? 2 : 1,
        borderColor: active ? activeColor : theme.borderSoft,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: active ? activeColor : theme.surface,
        opacity: disabled ? 0.45 : pressed ? 0.68 : 1,
        boxShadow: active
          ? `0 4px 12px ${activeColor}33`
          : '0 3px 9px rgba(15, 23, 42, 0.07)',
      })}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          color: active ? '#FFFFFF' : inactiveColor,
          fontSize: 14,
          fontWeight: '900',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CompactChoice({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
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
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRadius: appRadii.sm,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: active ? theme.hero : theme.border,
        backgroundColor: active ? theme.hero : theme.surface,
        opacity: disabled ? 0.45 : pressed ? 0.68 : 1,
      })}>
      <Text
        style={{
          color: active ? '#FFFFFF' : theme.textSecondary,
          fontSize: 14,
          fontWeight: '900',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function QuickButton({
  icon,
  label,
  disabled,
  destructive = false,
  onPress,
}: {
  icon: string;
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 9,
        borderWidth: 1,
        borderColor: destructive ? '#FECDD3' : theme.border,
        borderRadius: appRadii.sm,
        borderCurve: 'continuous',
        backgroundColor: theme.surface,
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
        boxShadow: '0 2px 7px rgba(15, 23, 42, 0.06)',
      })}>
      <AppIcon
        name={icon}
        color={destructive ? theme.danger : theme.textSecondary}
        size={15}
        fallback={destructive ? '×' : '•'}
      />
      <Text
        style={{
          color: destructive ? theme.danger : theme.text,
          fontSize: 12,
          fontWeight: '900',
        }}>
        {label}
      </Text>
    </Pressable>
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
        minHeight: 50,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: theme.borderSoft,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: theme.surface,
      }}>
      <Text
        selectable
        style={{ width: 28, color: theme.textSecondary, fontSize: 11, fontWeight: '900' }}>
        {label}
      </Text>
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
          minHeight: 40,
          flex: 1,
          padding: 0,
          color: theme.text,
          fontSize: 19,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
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

function describeBrush(brush: ShiftRequestBrush, slots: ShiftTimeSlot[]) {
  const type =
    brush.entryType === 'available'
      ? '勤務可能'
      : brush.entryType === 'preferred'
        ? '優先希望'
        : 'NG';
  if (brush.entryType === 'unavailable') return type;
  if (brush.isAllDay) return `終日 ${type}`;
  const slot = slots.find(
    (item) =>
      item.startTime === brush.startTime && item.endTime === brush.endTime,
  );
  return slot ? `${slot.shortLabel} ${type}` : `${brush.startTime}-${brush.endTime} ${type}`;
}
