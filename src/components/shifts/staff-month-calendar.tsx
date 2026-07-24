import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatTime, toDateKey } from '@/features/staff/date';
import type {
  AttendanceRecord,
  ShiftAssignment,
} from '@/features/staff/types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const CELL_HEIGHT = 68;

type Props = {
  yearMonth: string;
  assignments: ShiftAssignment[];
  attendanceRecords: AttendanceRecord[];
  onMonthChange: (yearMonth: string) => void;
};

type CalendarDay = {
  dateKey: string;
  day: number;
  inMonth: boolean;
};

export function StaffMonthCalendar({
  yearMonth,
  assignments,
  attendanceRecords,
  onMonthChange,
}: Props) {
  const theme = useAppTheme();
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(
    today.startsWith(yearMonth) ? today : `${yearMonth}-01`,
  );
  const days = useMemo(() => buildCalendarDays(yearMonth), [yearMonth]);
  const weeks = useMemo(
    () =>
      Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
        days.slice(index * 7, index * 7 + 7),
      ),
    [days],
  );
  const assignmentsByDate = useMemo(
    () => groupByDate(assignments, (item) => item.workDate),
    [assignments],
  );
  const attendanceByDate = useMemo(
    () => groupByDate(attendanceRecords, (item) => item.workDate),
    [attendanceRecords],
  );

  const selectedAssignments = assignmentsByDate.get(selectedDate) ?? [];
  const selectedAttendance = attendanceByDate.get(selectedDate) ?? [];
  const workdayCount = new Set(assignments.map((item) => item.workDate)).size;
  const attendanceDayCount = new Set(attendanceRecords.map((item) => item.workDate)).size;

  const changeMonth = (amount: number) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + amount, 1);
    const nextYearMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setSelectedDate(today.startsWith(nextYearMonth) ? today : `${nextYearMonth}-01`);
    onMonthChange(nextYearMonth);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.10)',
      }}>
      <View
        style={{
          padding: appSpacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: appSpacing.sm,
        }}>
        <MonthControl label="前月" symbol="‹" onPress={() => changeMonth(-1)} />
        <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
          <Text
            style={{
              color: theme.brandStrong,
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 1.6,
            }}>
            CALENDAR
          </Text>
          <Text
            selectable
            style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>
            {formatMonthLabel(yearMonth)}
          </Text>
        </View>
        <MonthControl label="翌月" symbol="›" onPress={() => changeMonth(1)} />
        <View style={{ flexDirection: 'row', gap: appSpacing.xs }}>
          <CountBadge value={workdayCount} tone="work" />
          <CountBadge value={attendanceDayCount} tone="attendance" />
        </View>
      </View>

      <View
        style={{
          minHeight: 34,
          flexDirection: 'row',
          alignItems: 'center',
          borderTopWidth: 1,
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
              color:
                index === 0
                  ? theme.danger
                  : index === 6
                    ? theme.info
                    : theme.text,
              fontSize: 12,
              fontWeight: '900',
            }}>
            {weekday}
          </Text>
        ))}
      </View>

      {weeks.map((week, rowIndex) => (
        <View
          key={week[0].dateKey}
          style={{ height: CELL_HEIGHT, flexDirection: 'row' }}>
          {week.map((day, columnIndex) => {
            const dayAssignments = assignmentsByDate.get(day.dateKey) ?? [];
            const dayAttendance = attendanceByDate.get(day.dateKey) ?? [];
            const isToday = day.dateKey === today;
            const isSelected = day.dateKey === selectedDate;
            const attendanceLabel = formatAttendanceDuration(dayAttendance);
            const statusLabel = attendanceLabel
              ? attendanceLabel
              : dayAssignments.length
                ? dayAssignments.length > 1
                  ? `勤務${dayAssignments.length}件`
                  : '勤務あり'
                : '—';

            return (
              <Pressable
                key={day.dateKey}
                accessibilityRole="button"
                accessibilityLabel={`${day.dateKey} ${statusLabel}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  setSelectedDate(day.dateKey);
                  if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                }}
                style={({ pressed }) => ({
                  height: CELL_HEIGHT,
                  minWidth: 0,
                  flex: 1,
                  padding: 3,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRightWidth: columnIndex === 6 ? 0 : 0.5,
                  borderBottomWidth: rowIndex === weeks.length - 1 ? 0 : 0.5,
                  borderColor: theme.border,
                  backgroundColor: pressed
                    ? theme.brandSoft
                    : isSelected
                      ? theme.surfaceMuted
                      : theme.surface,
                  opacity: day.inMonth ? 1 : 0.42,
                  outlineWidth: isToday ? 2 : isSelected ? 1 : 0,
                  outlineColor: isToday ? theme.brand : theme.border,
                  outlineOffset: -2,
                })}>
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                  }}>
                  <Text
                    style={{
                      color:
                        columnIndex === 0
                          ? theme.danger
                          : columnIndex === 6
                            ? theme.info
                            : theme.text,
                      fontSize: 13,
                      fontWeight: '900',
                    }}>
                    {day.day}
                  </Text>
                  {isToday ? (
                    <Text style={{ color: theme.brandStrong, fontSize: 7, fontWeight: '900' }}>
                      今日
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: '100%',
                    minHeight: 20,
                    paddingHorizontal: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: appRadii.pill,
                    backgroundColor: attendanceLabel
                      ? theme.infoSoft
                      : dayAssignments.length
                        ? theme.brandSoft
                        : 'transparent',
                  }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                      color: attendanceLabel
                        ? theme.info
                        : dayAssignments.length
                          ? theme.brandStrong
                          : theme.textSecondary,
                      fontSize: 8,
                      fontWeight: '900',
                    }}>
                    {statusLabel}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View
        style={{
          padding: appSpacing.md,
          gap: appSpacing.sm,
          borderTopWidth: 1,
          borderColor: theme.border,
        }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
          <Legend color="#8B5CF6" label="勤務あり" />
          <Legend color="#0EA5E9" label="打刻あり" />
          <Legend color={theme.border} label="勤務なし" />
        </View>
        <SelectedDaySummary
          dateKey={selectedDate}
          assignments={selectedAssignments}
          attendanceRecords={selectedAttendance}
        />
      </View>
    </View>
  );
}

function SelectedDaySummary({
  dateKey,
  assignments,
  attendanceRecords,
}: {
  dateKey: string;
  assignments: ShiftAssignment[];
  attendanceRecords: AttendanceRecord[];
}) {
  const theme = useAppTheme();

  return (
    <View style={{ gap: appSpacing.xs }}>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>
        {formatDateKey(dateKey)}
      </Text>
      {assignments.map((assignment) => (
        <Text
          key={assignment.id}
          selectable
          style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
          確定 {formatTime(assignment.startAt)}–{formatTime(assignment.endAt)} ·{' '}
          {assignment.storeName}
        </Text>
      ))}
      {attendanceRecords.map((record) => (
        <Text
          key={record.id}
          selectable
          style={{ color: theme.info, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>
          打刻 {formatTime(record.clockInAt)}
          {record.clockOutAt ? `–${formatTime(record.clockOutAt)}` : '–勤務中'} ·{' '}
          {record.storeName}
        </Text>
      ))}
      {!assignments.length && !attendanceRecords.length ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>勤務・打刻はありません。</Text>
      ) : null}
    </View>
  );
}

function MonthControl({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: appRadii.pill,
        backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
      })}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '500' }}>{symbol}</Text>
    </Pressable>
  );
}

function CountBadge({ value, tone }: { value: number; tone: 'work' | 'attendance' }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minWidth: 30,
        height: 26,
        paddingHorizontal: 7,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: appRadii.pill,
        backgroundColor: tone === 'work' ? '#EDE9FE' : theme.infoSoft,
      }}>
      <Text
        style={{
          color: tone === 'work' ? '#7C3AED' : theme.info,
          fontSize: 10,
          fontWeight: '900',
        }}>
        {value}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function buildCalendarDays(yearMonth: string): CalendarDay[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const leading = first.getDay();
  const total = Math.ceil((leading + lastDay) / 7) * 7;

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(year, month - 1, index - leading + 1);
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return {
      dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    };
  });
}

function groupByDate<T>(items: T[], dateFor: (item: T) => string) {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const date = dateFor(item);
    const values = result.get(date) ?? [];
    values.push(item);
    result.set(date, values);
  }
  return result;
}

function formatAttendanceDuration(records: AttendanceRecord[]) {
  const minutes = records.reduce((total, record) => {
    if (!record.clockOutAt) return total;
    const duration =
      (new Date(record.clockOutAt).getTime() - new Date(record.clockInAt).getTime()) /
        60_000 -
      record.breakMinutes;
    return total + Math.max(0, duration);
  }, 0);
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return hours ? `${hours}h${remainder ? `${remainder}m` : ''}` : `${remainder}m`;
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  return `${year}年${Number(month)}月`;
}

function formatDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}
