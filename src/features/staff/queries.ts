import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-provider';

import {
  addShiftAdjustmentEntry,
  applyToHelpRequest,
  deleteShiftAdjustmentEntry,
  fetchActiveAttendanceRecord,
  fetchAttendanceRecords,
  fetchAttendanceStoreStatuses,
  fetchHelpRequests,
  fetchNotifications,
  fetchNotificationPreferences,
  fetchOpenShiftPeriods,
  fetchPublishedAssignments,
  fetchPublishedSchedulePeriods,
  fetchStorePublishedSchedule,
  fetchShiftAdjustmentWindows,
  markAllNotificationsRead,
  markNotificationRead,
  recordAttendanceEvent,
  replaceShiftRequestEntries,
  setShiftRequestSubmitted,
  submitManualAttendance,
  submitShiftAdjustmentWindow,
  updateNotificationPreferences,
  updateStaffProfile,
} from './api';
import { addDays, toDateKey } from './date';
import { useStaff } from './staff-provider';

export function useStaffIdentity() {
  const { session } = useSession();
  const staff = useStaff();
  return {
    ...staff,
    userId: session?.user.id ?? null,
    tenantId: staff.activeTenant?.id ?? null,
    storeId: staff.activeStore?.id ?? null,
  };
}

export function useAssignments(daysBefore = 31, daysAfter = 62, includeAllStores = false) {
  const { userId, tenantId, storeId } = useStaffIdentity();
  const now = new Date();
  return useQuery({
    queryKey: ['assignments', userId, tenantId, storeId, daysBefore, daysAfter],
    queryFn: () =>
      fetchPublishedAssignments({
        userId: userId!,
        tenantId: tenantId!,
        storeId: includeAllStores ? undefined : (storeId ?? undefined),
        fromDate: toDateKey(addDays(now, -daysBefore)),
        toDate: toDateKey(addDays(now, daysAfter)),
      }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useAssignmentsForRange(
  fromDate: string,
  toDate: string,
  includeAllStores = false,
) {
  const { userId, tenantId, storeId } = useStaffIdentity();
  return useQuery({
    queryKey: [
      'assignments-range',
      userId,
      tenantId,
      includeAllStores ? 'all' : storeId,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      fetchPublishedAssignments({
        userId: userId!,
        tenantId: tenantId!,
        storeId: includeAllStores ? undefined : (storeId ?? undefined),
        fromDate,
        toDate,
      }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useOpenShiftPeriods(includeAllStores = false) {
  const { userId, tenantId, storeId } = useStaffIdentity();
  return useQuery({
    queryKey: ['open-shift-periods', userId, tenantId, storeId],
    queryFn: () =>
      fetchOpenShiftPeriods({
        userId: userId!,
        tenantId: tenantId!,
        storeId: includeAllStores ? undefined : (storeId ?? undefined),
      }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useStorePublishedSchedule(
  yearMonth: string,
  selectedStore?: { id: string; name: string },
) {
  const { tenantId, storeId, activeStore } = useStaffIdentity();
  const targetStoreId = selectedStore?.id ?? storeId;
  const targetStoreName = selectedStore?.name ?? activeStore?.name;
  return useQuery({
    queryKey: ['store-published-schedule', tenantId, targetStoreId, yearMonth],
    queryFn: () =>
      fetchStorePublishedSchedule({
        tenantId: tenantId!,
        storeId: targetStoreId!,
        storeName: targetStoreName!,
        yearMonth,
      }),
    enabled: Boolean(tenantId && targetStoreId && targetStoreName),
  });
}

export function usePublishedSchedulePeriods() {
  const { tenantId, stores } = useStaffIdentity();
  const storeIds = stores.map((store) => store.id);
  return useQuery({
    queryKey: ['published-schedule-periods', tenantId, storeIds.join(',')],
    queryFn: () =>
      fetchPublishedSchedulePeriods({
        tenantId: tenantId!,
        storeIds,
      }),
    enabled: Boolean(tenantId && storeIds.length),
  });
}

export function useAttendanceRecords(fromDate: string, toDate: string) {
  const { userId, tenantId, stores } = useStaffIdentity();
  const storeIds = stores.map((store) => store.id);
  return useQuery({
    queryKey: ['attendance-records', userId, tenantId, storeIds.join(','), fromDate, toDate],
    queryFn: () =>
      fetchAttendanceRecords({
        userId: userId!,
        tenantId: tenantId!,
        storeIds,
        fromDate,
        toDate,
      }),
    enabled: Boolean(userId && tenantId && storeIds.length),
  });
}

export function useShiftAdjustmentWindows() {
  const { userId, tenantId, storeId } = useStaffIdentity();
  return useQuery({
    queryKey: ['shift-adjustment-windows', userId, tenantId, storeId],
    queryFn: () =>
      fetchShiftAdjustmentWindows({
        userId: userId!,
        tenantId: tenantId!,
        storeId: storeId ?? undefined,
      }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useAddShiftAdjustmentEntry() {
  const queryClient = useQueryClient();
  const { userId, tenantId } = useStaffIdentity();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof addShiftAdjustmentEntry>[0], 'userId' | 'tenantId'>) =>
      addShiftAdjustmentEntry({ ...input, userId: userId!, tenantId: tenantId! }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['shift-adjustment-windows'] }),
  });
}

export function useDeleteShiftAdjustmentEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteShiftAdjustmentEntry,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['shift-adjustment-windows'] }),
  });
}

export function useSubmitShiftAdjustmentWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitShiftAdjustmentWindow,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shift-adjustment-windows'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useNotifications() {
  const { userId, tenantId } = useStaffIdentity();
  return useQuery({
    queryKey: ['notifications', userId, tenantId],
    queryFn: () => fetchNotifications({ userId: userId!, tenantId: tenantId! }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { userId, tenantId } = useStaffIdentity();
  return useMutation({
    mutationFn: (id: string) =>
      markNotificationRead({ id, userId: userId!, tenantId: tenantId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { userId, tenantId } = useStaffIdentity();
  return useMutation({
    mutationFn: () => markAllNotificationsRead({ userId: userId!, tenantId: tenantId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useHelpRequests() {
  const { userId, tenantId, stores } = useStaffIdentity();
  return useQuery({
    queryKey: ['help-requests', userId, tenantId, stores.map((store) => store.id).join(',')],
    queryFn: () =>
      fetchHelpRequests({
        userId: userId!,
        tenantId: tenantId!,
        storeIds: stores.map((store) => store.id),
      }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useApplyToHelpRequest() {
  const queryClient = useQueryClient();
  const { userId, tenantId } = useStaffIdentity();
  return useMutation({
    mutationFn: (input: { requestId: string; message?: string }) =>
      applyToHelpRequest({
        ...input,
        userId: userId!,
        tenantId: tenantId!,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['help-requests'] }),
  });
}

export function useActiveAttendanceRecord(requestedStoreId?: string) {
  const { userId, tenantId, storeId: activeStoreId } = useStaffIdentity();
  const storeId = requestedStoreId ?? activeStoreId;
  return useQuery({
    queryKey: ['active-attendance-record', userId, tenantId, storeId],
    queryFn: () =>
      fetchActiveAttendanceRecord({
        userId: userId!,
        tenantId: tenantId!,
        storeId: storeId!,
      }),
    enabled: Boolean(userId && tenantId && storeId),
    refetchInterval: 60_000,
  });
}

export function useAttendanceStoreStatuses() {
  const { userId, tenantId, stores } = useStaffIdentity();
  const storeIds = stores.map((store) => store.id);
  return useQuery({
    queryKey: ['attendance-store-statuses', userId, tenantId, storeIds.join(',')],
    queryFn: () =>
      fetchAttendanceStoreStatuses({
        userId: userId!,
        tenantId: tenantId!,
        storeIds,
      }),
    enabled: Boolean(userId && tenantId && storeIds.length),
    refetchInterval: 60_000,
  });
}

export function useRecordAttendanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordAttendanceEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['active-attendance-record'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-store-statuses'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-records'] }),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      ]);
    },
  });
}

export function useSaveShiftRequest() {
  const queryClient = useQueryClient();
  const { userId, tenantId } = useStaffIdentity();
  return useMutation({
    mutationFn: (input: Parameters<typeof replaceShiftRequestEntries>[0]) =>
      replaceShiftRequestEntries({ ...input, userId: userId!, tenantId: tenantId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['open-shift-periods'] }),
  });
}

export function useSetShiftRequestSubmitted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setShiftRequestSubmitted,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['open-shift-periods'] }),
  });
}

export function useNotificationPreferences() {
  const { userId, tenantId } = useStaffIdentity();
  return useQuery({
    queryKey: ['notification-preferences', userId, tenantId],
    queryFn: () => fetchNotificationPreferences({ userId: userId!, tenantId: tenantId! }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { userId, tenantId } = useStaffIdentity();
  return useMutation({
    mutationFn: (preferences: Parameters<typeof updateNotificationPreferences>[0]['preferences']) =>
      updateNotificationPreferences({
        userId: userId!,
        tenantId: tenantId!,
        preferences,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId, tenantId] }),
  });
}

export function useSubmitManualAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitManualAttendance,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['active-attendance-record'] });
    },
  });
}

export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  const { userId } = useStaffIdentity();
  return useMutation({
    mutationFn: (input: { displayName: string; phoneNumber: string | null }) =>
      updateStaffProfile({ ...input, userId: userId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-context', userId] }),
  });
}
