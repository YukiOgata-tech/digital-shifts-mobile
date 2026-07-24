import type { ShiftRequestDraftEntry } from '@/features/shift-request/draft';
import type { ShiftTimeSlot } from '@/features/staff/types';

export const DEFAULT_TIME_SLOT_COLOR = '#2563EB';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

type TimeSlotEntry = Pick<
  ShiftRequestDraftEntry,
  'entryType' | 'isAllDay' | 'startTime' | 'endTime' | 'timeSlotId'
>;

export function normalizeTimeSlotColor(value: string | null | undefined) {
  return value && HEX_COLOR_PATTERN.test(value)
    ? value.toUpperCase()
    : DEFAULT_TIME_SLOT_COLOR;
}

export function timeSlotPalette(value: string | null | undefined) {
  const base = normalizeTimeSlotColor(value);
  const soft = mixHexColors(base, '#FFFFFF', 0.84);
  const softStrong = mixHexColors(base, '#FFFFFF', 0.7);

  return {
    base,
    border: mixHexColors(base, '#FFFFFF', 0.38),
    soft,
    softStrong,
    onBase: readableTextColor(base),
    onSoft: readableTextColor(soft),
  };
}

export function resolveTimeSlot(
  entry: TimeSlotEntry | undefined,
  timeSlots: ShiftTimeSlot[],
) {
  if (!entry || entry.entryType === 'unavailable' || entry.isAllDay) return undefined;

  if (entry.timeSlotId) {
    const byId = timeSlots.find((slot) => slot.id === entry.timeSlotId);
    if (byId) return byId;
  }

  return timeSlots.find(
    (slot) =>
      slot.startTime === entry.startTime && slot.endTime === entry.endTime,
  );
}

function mixHexColors(from: string, to: string, toWeight: number) {
  const first = hexToRgb(normalizeTimeSlotColor(from));
  const second = hexToRgb(to);
  const weight = Math.max(0, Math.min(1, toWeight));
  return rgbToHex({
    red: Math.round(first.red + (second.red - first.red) * weight),
    green: Math.round(first.green + (second.green - first.green) * weight),
    blue: Math.round(first.blue + (second.blue - first.blue) * weight),
  });
}

function readableTextColor(background: string) {
  const { red, green, blue } = hexToRgb(background);
  const luminance =
    0.2126 * linearize(red / 255) +
    0.7152 * linearize(green / 255) +
    0.0722 * linearize(blue / 255);

  return luminance > 0.42 ? '#0F172A' : '#FFFFFF';
}

function linearize(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function hexToRgb(value: string) {
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
}

function rgbToHex(value: { red: number; green: number; blue: number }) {
  return `#${[value.red, value.green, value.blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
