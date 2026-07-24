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

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const CELL_HEIGHT = 68;

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
  editableDates: Set<string>;
  closedReasons: Map<string, string | null>;
  dragEnabled: boolean;
  disabled: boolean;
  brushForDate?: (date: string) => ShiftRequestBrush;
  onChange: (draft: ShiftRequestDraft) => void;
  onEdit: (date: string) => void;
};

function toneForEntry(
  entry: ShiftRequestDraft[string],
  theme: ReturnType<typeof useAppTheme>,
) {
  if (!entry) return { background: theme.surface, foreground: theme.textSecondary };
  if (entry.entryType === 'available') {
    return { background: theme.brandSoft, foreground: theme.brandStrong };
  }
  if (entry.entryType === 'preferred') {
    return { background: theme.warningSoft, foreground: theme.warning };
  }
  return { background: theme.dangerSoft, foreground: theme.danger };
}

function compactEntryLabel(entry: ShiftRequestDraft[string]) {
  if (!entry) return { primary: '未入力', secondary: '' };
  if (entry.entryType === 'unavailable') {
    return { primary: 'NG', secondary: '終日' };
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
  editableDates,
  closedReasons,
  dragEnabled,
  disabled,
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
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: theme.surface,
      }}>
      <View
        accessibilityRole="header"
        style={{
          minHeight: 36,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surfaceMuted,
        }}>
        {WEEKDAYS.map((weekday, index) => (
          <Text
            key={weekday}
            style={{
              flex: 1,
              textAlign: 'center',
              color: index === 0 ? theme.danger : index === 6 ? theme.info : theme.textSecondary,
              fontSize: 12,
              fontWeight: '700',
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
                const tone = toneForEntry(previewEntry, theme);
                const compactLabel = compactEntryLabel(previewEntry);
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
                      height: CELL_HEIGHT,
                      minWidth: 0,
                      flex: 1,
                      paddingHorizontal: 2,
                      paddingVertical: appSpacing.xs,
                      alignItems: 'center',
                      justifyContent: 'space-between',
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
                    {day.inPeriod ? (
                      <>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{
                            color:
                              columnIndex === 0
                                ? theme.danger
                                : columnIndex === 6
                                  ? theme.info
                                  : theme.text,
                            fontSize: 12,
                            fontWeight: '800',
                          }}>
                          {dateLabel}
                        </Text>
                        <View style={{ width: '100%', alignItems: 'center', gap: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: isClosed ? theme.textSecondary : tone.foreground,
                              fontSize: 9,
                              fontWeight: '900',
                            }}>
                            {isClosed ? '休業' : compactLabel.primary}
                          </Text>
                          {isClosed || !compactLabel.secondary ? null : (
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
                          )}
                        </View>
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}
