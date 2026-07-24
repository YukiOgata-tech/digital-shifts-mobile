import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  applyBrushStroke,
  describeEntry,
  determineStrokeMode,
  entryMatchesBrush,
  type ShiftCalendarDay,
  type ShiftRequestBrush,
  type ShiftRequestDraft,
  type StrokeMode,
} from '@/features/shift-request/draft';
import {
  resolveTimeSlot,
  timeSlotPalette,
} from '@/features/shift-request/time-slot-colors';
import type { ShiftTimeSlot } from '@/features/staff/types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const CELL_HEIGHT = 76;

type Stroke = {
  mode: StrokeMode;
  dates: Set<string>;
  lastX: number;
  lastY: number;
};

type Props = {
  days: ShiftCalendarDay[];
  draft: ShiftRequestDraft;
  brush: ShiftRequestBrush;
  timeSlots: ShiftTimeSlot[];
  editableDates: Set<string>;
  closedReasons: Map<string, string | null>;
  dragEnabled: boolean;
  disabled: boolean;
  embedded?: boolean;
  brushForDate?: (date: string) => ShiftRequestBrush;
  onChange: (draft: ShiftRequestDraft) => void;
  onEdit: (date: string) => void;
};

function toneForEntry(
  entry: ShiftRequestDraft[string],
  timeSlot: ShiftTimeSlot | undefined,
  theme: ReturnType<typeof useAppTheme>,
) {
  if (!entry) return { background: theme.surface, foreground: theme.textSecondary };
  if (timeSlot) {
    const palette = timeSlotPalette(timeSlot.color);
    return {
      accent: palette.base,
      background: palette.soft,
      foreground: palette.onSoft,
    };
  }
  if (entry.entryType === 'available') {
    return { background: theme.brandSoft, foreground: theme.brandStrong };
  }
  if (entry.entryType === 'preferred') {
    return { background: theme.warningSoft, foreground: theme.warning };
  }
  return { background: theme.surfaceMuted, foreground: theme.textSecondary };
}

function compactEntryLabel(
  entry: ShiftRequestDraft[string],
  timeSlot: ShiftTimeSlot | undefined,
) {
  if (!entry) return { primary: '未入力', secondary: '' };
  if (entry.entryType === 'unavailable') {
    return { primary: 'NG', secondary: '終日' };
  }
  if (timeSlot) {
    return {
      primary: timeSlot.shortLabel,
      secondary: entry.entryType === 'preferred' ? '優先希望' : '勤務可能',
    };
  }
  return {
    primary: entry.entryType === 'preferred' ? '優先' : '勤務可',
    secondary: entry.isAllDay ? '終日' : `${entry.startTime}–${entry.endTime}`,
  };
}

export function ShiftRequestCalendar({
  days,
  draft,
  brush,
  timeSlots,
  editableDates,
  closedReasons,
  dragEnabled,
  disabled,
  embedded = false,
  brushForDate,
  onChange,
  onEdit,
}: Props) {
  const theme = useAppTheme();
  const widthRef = useRef(0);
  const strokeRef = useRef<Stroke | null>(null);
  const longPressRef = useRef<{ date: string; at: number } | null>(null);
  const [strokePreview, setStrokePreview] = useState<{
    mode: StrokeMode;
    dates: Set<string>;
  } | null>(null);
  const weeks = useMemo(
    () =>
      Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
        days.slice(index * 7, index * 7 + 7),
      ),
    [days],
  );
  const firstPeriodDate = days.find((day) => day.inPeriod)?.dateKey;

  const indexAt = (x: number, y: number) => {
    const width = widthRef.current;
    if (width <= 0 || x < 0 || y < 0 || x >= width) return -1;
    const column = Math.floor(x / (width / 7));
    const row = Math.floor(y / CELL_HEIGHT);
    const index = row * 7 + column;
    return index >= 0 && index < days.length ? index : -1;
  };

  const visitPoint = (x: number, y: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const index = indexAt(x, y);
    const day = days[index];
    if (day && editableDates.has(day.dateKey)) {
      stroke.dates.add(day.dateKey);
    }
  };

  const beginStroke = (x: number, y: number) => {
    if (!dragEnabled || disabled) return;
    const day = days[indexAt(x, y)];
    if (!day || !editableDates.has(day.dateKey)) return;
    const mode = determineStrokeMode(draft[day.dateKey], brush);
    strokeRef.current = {
      mode,
      dates: new Set([day.dateKey]),
      lastX: x,
      lastY: y,
    };
    setStrokePreview({ mode, dates: new Set([day.dateKey]) });
  };

  const continueStroke = (x: number, y: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const distance = Math.hypot(x - stroke.lastX, y - stroke.lastY);
    const cellWidth = widthRef.current / 7;
    const steps = Math.max(1, Math.ceil(distance / Math.max(12, Math.min(cellWidth, CELL_HEIGHT) / 2)));
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      visitPoint(
        stroke.lastX + (x - stroke.lastX) * progress,
        stroke.lastY + (y - stroke.lastY) * progress,
      );
    }
    stroke.lastX = x;
    stroke.lastY = y;
    setStrokePreview({ mode: stroke.mode, dates: new Set(stroke.dates) });
  };

  const finishStroke = () => {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    setStrokePreview(null);
    if (!stroke?.dates.size) return;
    onChange(
      applyBrushStroke({
        draft,
        dates: [...stroke.dates],
        brush,
        mode: stroke.mode,
        editableDates,
      }),
    );
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  const cancelStroke = () => {
    strokeRef.current = null;
    setStrokePreview(null);
  };

  // Gesture Handler stores these callbacks for native events; refs are read only
  // after a gesture begins, never while React is rendering.
  /* eslint-disable react-hooks/refs */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dragEnabled && !disabled)
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => beginStroke(event.x, event.y))
        .onUpdate((event) => continueStroke(event.x, event.y))
        .onEnd(finishStroke)
        .onFinalize((_event, success) => {
          if (!success) cancelStroke();
        }),
    // Gesture callbacks intentionally follow the latest render state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brush, disabled, dragEnabled, draft, editableDates],
  );
  /* eslint-enable react-hooks/refs */

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
  };

  const tapDate = (date: string) => {
    if (disabled || dragEnabled || !editableDates.has(date)) return;
    const dateBrush = brushForDate?.(date) ?? brush;
    const mode = determineStrokeMode(draft[date], dateBrush);
    onChange(
      applyBrushStroke({
        draft,
        dates: [date],
        brush: dateBrush,
        mode,
        editableDates,
      }),
    );
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  return (
    <View
      style={{
        overflow: 'hidden',
        borderWidth: embedded ? 0 : 1,
        borderColor: theme.border,
        borderRadius: embedded ? 0 : appRadii.lg,
        borderCurve: 'continuous',
        backgroundColor: theme.surface,
        boxShadow: embedded ? undefined : '0 8px 20px rgba(15, 23, 42, 0.10)',
      }}>
      <View
        accessibilityRole="header"
        style={{
          minHeight: 36,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}>
        {WEEKDAYS.map((weekday, index) => (
          <Text
            key={weekday}
            style={{
              flex: 1,
              textAlign: 'center',
              color: index === 0 ? theme.danger : index === 6 ? theme.info : theme.textSecondary,
              fontSize: 13,
              fontWeight: '900',
            }}>
            {weekday}
          </Text>
        ))}
      </View>

      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout}>
          {weeks.map((week, rowIndex) => (
            <View
              key={week[0]?.dateKey ?? `week-${rowIndex}`}
              style={{ height: CELL_HEIGHT, flexDirection: 'row' }}>
              {week.map((day, columnIndex) => {
                const closedReason = closedReasons.get(day.dateKey);
                const isClosed = closedReasons.has(day.dateKey);
                const editable = editableDates.has(day.dateKey) && !disabled;
                const previewed = strokePreview?.dates.has(day.dateKey) ?? false;
                const storedEntry = draft[day.dateKey];
                const previewEntry =
                  previewed && strokePreview?.mode === 'stamp'
                    ? { workDate: day.dateKey, ...brush, note: '' }
                    : previewed &&
                        strokePreview?.mode === 'erase' &&
                        entryMatchesBrush(storedEntry, brush)
                      ? undefined
                      : storedEntry;
                const timeSlot = resolveTimeSlot(previewEntry, timeSlots);
                const tone = toneForEntry(previewEntry, timeSlot, theme);
                const compactLabel = compactEntryLabel(previewEntry, timeSlot);
                const status = isClosed
                  ? closedReason
                    ? `休業日 ${closedReason}`
                    : '休業日'
                  : day.inPeriod
                    ? describeEntry(previewEntry)
                    : '期間外';
                const dateLabel =
                  day.dateKey === firstPeriodDate || day.day === 1
                    ? `${Number(day.dateKey.slice(5, 7))}/${day.day}`
                    : `${day.day}`;

                return (
                  <Pressable
                    key={day.dateKey}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.dateKey} ${status}`}
                    accessibilityHint={
                      editable
                        ? dragEnabled
                          ? 'この日から指でなぞって複数日を入力します'
                          : 'タップで現在の入力ブラシを反映、長押しで詳細編集します'
                        : undefined
                    }
                    accessibilityState={{
                      disabled: !editable,
                      selected: Boolean(previewEntry),
                    }}
                    disabled={!editable || dragEnabled}
                    onPress={() => {
                      const longPress = longPressRef.current;
                      longPressRef.current = null;
                      if (
                        longPress?.date === day.dateKey &&
                        Date.now() - longPress.at < 1_000
                      ) {
                        return;
                      }
                      tapDate(day.dateKey);
                    }}
                    onLongPress={() => {
                      longPressRef.current = { date: day.dateKey, at: Date.now() };
                      onEdit(day.dateKey);
                    }}
                    delayLongPress={450}
                    style={({ pressed }) => ({
                      position: 'relative',
                      height: CELL_HEIGHT,
                      minWidth: 0,
                      flex: 1,
                      paddingHorizontal: 3,
                      paddingVertical: appSpacing.xs,
                      gap: 2,
                      borderRightWidth: columnIndex === 6 ? 0 : 0.5,
                      borderBottomWidth: rowIndex === weeks.length - 1 ? 0 : 0.5,
                      borderColor: theme.borderSoft,
                      backgroundColor: day.inPeriod
                        ? isClosed
                          ? theme.surfaceMuted
                          : tone.background
                        : theme.background,
                      opacity: pressed ? 0.65 : 1,
                      outlineWidth: previewed ? 2 : 0,
                      outlineColor: previewed ? theme.brand : 'transparent',
                      outlineOffset: -2,
                    })}>
                    {tone.accent ? (
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          left: 0,
                          height: 3,
                          backgroundColor: tone.accent,
                        }}
                      />
                    ) : null}
                    <View
                      style={{
                        minHeight: 26,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                      }}>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{
                          color: !day.inPeriod
                            ? theme.border
                            : columnIndex === 0
                              ? theme.danger
                              : columnIndex === 6
                                ? theme.info
                                : theme.text,
                          fontSize: 12,
                          fontWeight: '900',
                          fontVariant: ['tabular-nums'],
                        }}>
                        {dateLabel}
                      </Text>
                      {editable && !dragEnabled ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${day.dateKey}を詳しく編集`}
                          hitSlop={2}
                          onPress={(event) => {
                            event.stopPropagation();
                            onEdit(day.dateKey);
                          }}
                          style={({ pressed: editPressed }) => ({
                            width: 26,
                            height: 26,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            borderCurve: 'continuous',
                            borderWidth: 1,
                            borderColor: theme.borderSoft,
                            backgroundColor: theme.surface,
                            opacity: editPressed ? 0.55 : 1,
                          })}>
                          <Text
                            style={{
                              color: theme.textSecondary,
                              fontSize: storedEntry ? 12 : 17,
                              fontWeight: '700',
                            }}>
                            {storedEntry ? '•••' : '+'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View
                      style={{
                        minHeight: 36,
                        flex: 1,
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}>
                      {!day.inPeriod ? (
                        <Text style={{ color: theme.border, fontSize: 15, fontWeight: '900' }}>-</Text>
                      ) : isClosed ? (
                        <Text
                          numberOfLines={2}
                          style={{
                            color: theme.warning,
                            fontSize: 9,
                            fontWeight: '900',
                            textAlign: 'center',
                          }}>
                          休業
                          {closedReason ? `\n${closedReason}` : ''}
                        </Text>
                      ) : previewEntry ? (
                        <>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: tone.foreground,
                              fontSize: 9,
                              fontWeight: '900',
                            }}>
                            {compactLabel.primary}
                          </Text>
                          {compactLabel.secondary ? (
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.65}
                              style={{
                                width: '100%',
                                textAlign: 'center',
                                color: tone.foreground,
                                fontSize: 8,
                                fontWeight: '700',
                                fontVariant: ['tabular-nums'],
                              }}>
                              {compactLabel.secondary}
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text style={{ color: theme.border, fontSize: 23, fontWeight: '700' }}>＋</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </GestureDetector>

      <View
        style={{
          minHeight: 42,
          gap: appSpacing.sm,
          paddingHorizontal: appSpacing.md,
          paddingVertical: appSpacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.borderSoft,
          backgroundColor: theme.surface,
        }}>
        {timeSlots.length ? (
          <View style={{ gap: 5 }}>
            <Text
              selectable
              style={{ color: theme.text, fontSize: 10, fontWeight: '900' }}>
              勤務時間帯
            </Text>
            <View
              accessibilityRole="list"
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: appSpacing.sm,
              }}>
              {timeSlots.map((slot) => (
                <LegendDot
                  key={slot.id}
                  color={timeSlotPalette(slot.color).base}
                  label={`${slot.shortLabel} ${slot.startTime}-${slot.endTime}`}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: appSpacing.md,
          }}>
          {timeSlots.length ? (
            <Text
              selectable
              style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>
              勤務区分はセル内に表示
            </Text>
          ) : (
            <>
              <LegendDot color={theme.brand} label="勤務可能" />
              <LegendDot color={theme.warning} label="優先希望" />
            </>
          )}
          <LegendDot color={theme.textSecondary} label="NG" />
          <LegendDot color="#F43F5E" label="日曜・祝日" />
          <LegendDot color="#2563EB" label="土曜" />
        </View>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={{
          width: 13,
          height: 13,
          borderRadius: 4,
          borderCurve: 'continuous',
          backgroundColor: color,
        }}
      />
      <Text selectable style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>
        {label}
      </Text>
    </View>
  );
}
