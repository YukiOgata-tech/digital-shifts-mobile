import type {
  ShiftRequestEntry,
  ShiftTimeSlot,
} from '@/features/staff/types';

export type ShiftRequestEntryType = ShiftRequestEntry['entryType'];

export type ShiftRequestDraftEntry = {
  workDate: string;
  entryType: ShiftRequestEntryType;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  timeSlotId: string | null;
  note: string;
};

export type ShiftRequestBrush = Omit<ShiftRequestDraftEntry, 'workDate' | 'note'>;
export type ShiftRequestDraft = Record<string, ShiftRequestDraftEntry | undefined>;
export type StrokeMode = 'stamp' | 'erase';

export type ShiftCalendarDay = {
  dateKey: string;
  day: number;
  inPeriod: boolean;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseDateKey(dateKey: string) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function enumerateDateKeys(startDate: string, endDate: string) {
  const result: string[] = [];
  let current = startDate;
  while (current <= endDate && result.length < 70) {
    result.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return result;
}

export function buildCalendarDays(startDate: string, endDate: string): ShiftCalendarDay[] {
  const first = parseDateKey(startDate);
  const last = parseDateKey(endDate);
  const gridStart = addDaysToDateKey(startDate, -first.getUTCDay());
  const trailingDays = 6 - last.getUTCDay();
  const gridEnd = addDaysToDateKey(endDate, trailingDays);

  return enumerateDateKeys(gridStart, gridEnd).map((dateKey) => ({
    dateKey,
    day: Number(dateKey.slice(8, 10)),
    inPeriod: dateKey >= startDate && dateKey <= endDate,
  }));
}

function formatIsoTime(value: string | null, timeZone: string, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function entriesToDraft(entries: ShiftRequestEntry[], timeZone: string): ShiftRequestDraft {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.workDate,
      {
        workDate: entry.workDate,
        entryType: entry.entryType,
        isAllDay: entry.isAllDay,
        startTime: formatIsoTime(entry.startAt, timeZone, '09:00'),
        endTime: formatIsoTime(entry.endAt, timeZone, '18:00'),
        timeSlotId: entry.timeSlotId,
        note: entry.note ?? '',
      } satisfies ShiftRequestDraftEntry,
    ]),
  );
}

export function createDefaultBrush(
  useTimeSlots: boolean,
  slots: ShiftTimeSlot[],
): ShiftRequestBrush {
  const slot = slots[0];
  if (slot) {
    return {
      entryType: 'available',
      isAllDay: false,
      startTime: slot.startTime,
      endTime: slot.endTime,
      timeSlotId: useTimeSlots ? slot.id : null,
    };
  }
  return {
    entryType: 'available',
    isAllDay: true,
    startTime: '09:00',
    endTime: '18:00',
    timeSlotId: null,
  };
}

export function isValidTime(value: string) {
  return TIME_PATTERN.test(value);
}

export function validateDraft(draft: ShiftRequestDraft, editableDates: Set<string>) {
  for (const [date, entry] of Object.entries(draft)) {
    if (!entry || !editableDates.has(date)) continue;
    if (entry.entryType === 'unavailable' && !entry.isAllDay) {
      return `${date}のNG指定は終日にしてください。`;
    }
    if (!entry.isAllDay && (!isValidTime(entry.startTime) || !isValidTime(entry.endTime))) {
      return `${date}の時刻を00:00〜23:59の形式で入力してください。`;
    }
    if (entry.note.length > 400) {
      return `${date}のメモは400文字以内で入力してください。`;
    }
  }
  return null;
}

export function entryMatchesBrush(
  entry: ShiftRequestDraftEntry | undefined,
  brush: ShiftRequestBrush,
) {
  if (!entry || entry.entryType !== brush.entryType || entry.isAllDay !== brush.isAllDay) {
    return false;
  }
  if (brush.isAllDay) return true;
  return entry.startTime === brush.startTime && entry.endTime === brush.endTime;
}

export function determineStrokeMode(
  entry: ShiftRequestDraftEntry | undefined,
  brush: ShiftRequestBrush,
): StrokeMode {
  return entryMatchesBrush(entry, brush) ? 'erase' : 'stamp';
}

export function applyBrushStroke(input: {
  draft: ShiftRequestDraft;
  dates: string[];
  brush: ShiftRequestBrush;
  mode: StrokeMode;
  editableDates: Set<string>;
}) {
  const next = { ...input.draft };
  for (const workDate of input.dates) {
    if (!input.editableDates.has(workDate)) continue;
    if (input.mode === 'erase') {
      if (entryMatchesBrush(next[workDate], input.brush)) {
        delete next[workDate];
      }
      continue;
    }
    next[workDate] = {
      workDate,
      ...input.brush,
      note: next[workDate]?.note ?? '',
    };
  }
  return next;
}

export function fillUnentered(input: {
  draft: ShiftRequestDraft;
  brush: ShiftRequestBrush;
  editableDates: Set<string>;
}) {
  const dates = [...input.editableDates].filter((date) => !input.draft[date]);
  return {
    count: dates.length,
    draft: applyBrushStroke({ ...input, dates, mode: 'stamp' }),
  };
}

export function copyPreviousWeek(
  draft: ShiftRequestDraft,
  editableDates: Set<string>,
) {
  const next = { ...draft };
  let count = 0;
  for (const date of [...editableDates].sort()) {
    if (next[date]) continue;
    const source = draft[addDaysToDateKey(date, -7)];
    if (!source) continue;
    next[date] = {
      ...source,
      workDate: date,
    };
    count += 1;
  }
  return { draft: next, count };
}

export function draftEntries(draft: ShiftRequestDraft, editableDates: Set<string>) {
  return [...editableDates]
    .sort()
    .flatMap((date) => (draft[date] ? [draft[date]!] : []));
}

export function draftSignature(draft: ShiftRequestDraft, editableDates: Set<string>) {
  return JSON.stringify(draftEntries(draft, editableDates));
}

export function describeEntry(entry: ShiftRequestDraftEntry | undefined) {
  if (!entry) return '未入力';
  const type =
    entry.entryType === 'available'
      ? '勤務可'
      : entry.entryType === 'preferred'
        ? '優先希望'
        : 'NG';
  if (entry.isAllDay) return type;
  return `${type} ${entry.startTime}–${entry.endTime}`;
}
