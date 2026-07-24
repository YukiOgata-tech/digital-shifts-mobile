import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ShiftRequestBrush, ShiftRequestEntryType } from '@/features/shift-request/draft';

export type DayDefault = {
  entryType: ShiftRequestEntryType;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
} | null;

export type MobilePreferences = {
  locale: 'ja' | 'en';
  tapBehavior: 'weekday-default' | 'current-brush';
  defaultSchedule: DayDefault[];
};

export const EMPTY_DEFAULT_SCHEDULE: DayDefault[] = Array.from({ length: 7 }, () => null);

export const DEFAULT_MOBILE_PREFERENCES: MobilePreferences = {
  locale: 'ja',
  tapBehavior: 'weekday-default',
  defaultSchedule: EMPTY_DEFAULT_SCHEDULE,
};

function storageKey(userId: string) {
  return `staff:${userId}:mobile-preferences:v1`;
}

function isEntryType(value: unknown): value is ShiftRequestEntryType {
  return value === 'available' || value === 'preferred' || value === 'unavailable';
}

function normalizeDay(value: unknown): DayDefault {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<NonNullable<DayDefault>>;
  if (!isEntryType(candidate.entryType)) return null;
  const isUnavailable = candidate.entryType === 'unavailable';
  return {
    entryType: candidate.entryType,
    isAllDay: isUnavailable || candidate.isAllDay !== false,
    startTime:
      typeof candidate.startTime === 'string' ? candidate.startTime : '09:00',
    endTime: typeof candidate.endTime === 'string' ? candidate.endTime : '18:00',
  };
}

export async function readMobilePreferences(userId: string): Promise<MobilePreferences> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_MOBILE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<MobilePreferences>;
    const schedule = Array.isArray(parsed.defaultSchedule)
      ? Array.from({ length: 7 }, (_, index) => normalizeDay(parsed.defaultSchedule?.[index]))
      : EMPTY_DEFAULT_SCHEDULE;
    return {
      locale: parsed.locale === 'en' ? 'en' : 'ja',
      tapBehavior:
        parsed.tapBehavior === 'current-brush' ? 'current-brush' : 'weekday-default',
      defaultSchedule: schedule,
    };
  } catch {
    return DEFAULT_MOBILE_PREFERENCES;
  }
}

export async function writeMobilePreferences(
  userId: string,
  preferences: MobilePreferences,
) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(preferences));
}

export async function clearMobilePreferences(userId: string) {
  await AsyncStorage.removeItem(storageKey(userId));
}

export function weekdayIndex(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

export function resolveBrushForDate(
  preferences: MobilePreferences | null,
  dateKey: string,
  currentBrush: ShiftRequestBrush,
): ShiftRequestBrush {
  if (!preferences || preferences.tapBehavior === 'current-brush') return currentBrush;
  const day = preferences.defaultSchedule[weekdayIndex(dateKey)];
  if (!day) return currentBrush;
  return {
    entryType: day.entryType,
    isAllDay: day.entryType === 'unavailable' ? true : day.isAllDay,
    startTime: day.startTime,
    endTime: day.endTime,
    timeSlotId: null,
  };
}
