import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-provider';

import {
  applyToHelpRequest,
  fetchActiveAttendanceRecord,
  fetchHelpRequests,
  fetchNotifications,
  fetchNotificationPreferences,
  fetchOpenShiftPeriods,
  fetchPublishedAssignments,
  markAllNotificationsRead,
  markNotificationRead,
  recordAttendanceEvent,
  replaceShiftRequestEntries,
  setShiftRequestSubmitted,
  submitManualAttendance,
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

export function useAssignments(daysBefore = 31, daysAfter = 62) {
  const { userId, tenantId, storeId } = useStaffIdentity();
  const now = new Date();
  return useQuery({
    queryKey: ['assignments', userId, tenantId, storeId, daysBefore, daysAfter],
    queryFn: () =>
      fetchPublishedAssignments({
        userId: userId!,
        tenantId: tenantId!,
        storeId: storeId ?? undefined,
        fromDate: toDateKey(addDays(now, -daysBefore)),
        toDate: toDateKey(addDays(now, daysAfter)),
      }),
    enabled: Boolean(userId && tenantId),
  });
}

export function useOpenShiftPeriods() {
  const { userId, tenantId, storeId } = useStaffIdentity();
  return useQuery({
    queryKey: ['open-shift-periods', userId, tenantId, storeId],
    queryFn: () =>
      fetchOpenShiftPeriods({
        userId: userId!,
        tenantId: tenantId!,
        storeId: storeId ?? undefined,
      }),
    enabled: Boolean(userId && tenantId),
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

export function useActiveAttendanceRecord() {
  const { userId, tenantId, storeId } = useStaffIdentity();
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

export function useRecordAttendanceEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordAttendanceEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['active-attendance-record'] }),
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
