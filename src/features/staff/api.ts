import { supabase } from '@/lib/supabase';

import type {
  AttendanceRecord,
  HelpRequest,
  OpenShiftPeriod,
  NotificationPreferences,
  ShiftAssignment,
  ShiftAdjustmentRequestType,
  ShiftAdjustmentWindow,
  ShiftRequestEntry,
  StaffContextData,
  StaffNotification,
  StorePublishedSchedule,
  StaffStore,
  StaffTenant,
} from './types';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabaseの公開環境変数が設定されていません。');
  }
  return supabase;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function fetchStaffContext(userId: string): Promise<StaffContextData> {
  const client = requireSupabase();
  const [{ data: profile, error: profileError }, { data: tenantRows, error: tenantError }] =
    await Promise.all([
      client
        .from('profiles')
        .select('id, display_name, email, phone_number, avatar_url, timezone')
        .eq('id', userId)
        .single(),
      client
        .from('tenant_memberships')
        .select('tenant_id, role, status, tenants(id, name, slug, status)')
        .eq('user_id', userId)
        .eq('status', 'active'),
    ]);

  if (profileError) throw profileError;
  if (tenantError) throw tenantError;

  const tenants = (tenantRows ?? []).flatMap((row) => {
    const tenant = one(row.tenants);
    if (!tenant || tenant.status !== 'active') return [];
    return [
      {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: row.role,
      } satisfies StaffTenant,
    ];
  });

  const tenantIds = tenants.map((tenant) => tenant.id);
  let stores: StaffStore[] = [];

  if (tenantIds.length) {
    const { data: storeRows, error: storeError } = await client
      .from('store_memberships')
      .select(
        'tenant_id, store_id, role, status, stores(id, tenant_id, name, code, address, timezone, is_active, attendance_lat, attendance_lng, attendance_gps_radius_meters)',
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('tenant_id', tenantIds);

    if (storeError) throw storeError;

    stores = (storeRows ?? []).flatMap((row) => {
      const store = one(row.stores);
      if (!store || !store.is_active) return [];
      return [
        {
          id: store.id,
          tenantId: store.tenant_id,
          name: store.name,
          code: store.code,
          address: store.address,
          timezone: store.timezone,
          role: row.role,
          attendanceLat: store.attendance_lat,
          attendanceLng: store.attendance_lng,
          attendanceGpsRadiusMeters: store.attendance_gps_radius_meters ?? 150,
        } satisfies StaffStore,
      ];
    });
  }

  return {
    profile: {
      id: profile.id,
      displayName: profile.display_name || profile.email || 'スタッフ',
      email: profile.email,
      phoneNumber: profile.phone_number,
      avatarUrl: profile.avatar_url,
      timezone: profile.timezone || 'Asia/Tokyo',
    },
    tenants,
    stores,
  };
}

export async function fetchPublishedAssignments(input: {
  userId: string;
  tenantId: string;
  storeId?: string;
  fromDate: string;
  toDate: string;
}): Promise<ShiftAssignment[]> {
  const client = requireSupabase();
  let query = client
    .from('shift_assignments')
    .select(
      'id, store_id, work_date, start_at, end_at, break_minutes, status, role_label, stores(name), shift_schedules!inner(is_published)',
    )
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .eq('shift_schedules.is_published', true)
    .gte('work_date', input.fromDate)
    .lte('work_date', input.toDate)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true });

  if (input.storeId) query = query.eq('store_id', input.storeId);
  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    storeId: row.store_id,
    storeName: one(row.stores)?.name ?? '店舗',
    workDate: row.work_date,
    startAt: row.start_at,
    endAt: row.end_at,
    breakMinutes: row.break_minutes ?? 0,
    status: row.status,
    roleLabel: row.role_label,
  }));
}

export async function fetchStorePublishedSchedule(input: {
  tenantId: string;
  storeId: string;
  storeName: string;
  yearMonth: string;
}): Promise<StorePublishedSchedule> {
  const client = requireSupabase();
  const monthStart = `${input.yearMonth}-01`;
  const [year, month] = input.yearMonth.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  const [{ data: memberRows, error: memberError }, { data: assignmentRows, error: assignmentError }] =
    await Promise.all([
      client
        .from('store_memberships')
        .select(
          'user_id, role, show_on_shift_sheet, profiles(display_name, email)',
        )
        .eq('tenant_id', input.tenantId)
        .eq('store_id', input.storeId)
        .eq('status', 'active')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      client
        .from('shift_assignments')
        .select(
          'id, user_id, work_date, start_at, end_at, break_minutes, role_label, note, store_shift_time_slots(short_label, name), shift_schedules!inner(is_published)',
        )
        .eq('tenant_id', input.tenantId)
        .eq('store_id', input.storeId)
        .eq('status', 'confirmed')
        .eq('shift_schedules.is_published', true)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd)
        .order('work_date', { ascending: true })
        .order('start_at', { ascending: true }),
    ]);

  if (memberError) throw memberError;
  if (assignmentError) throw assignmentError;

  const members = (memberRows ?? []).map((row) => {
    const profile = one(row.profiles);
    return {
      userId: row.user_id,
      displayName: profile?.display_name || profile?.email || '名前未設定',
      role: row.role,
      showOnShiftSheet: row.show_on_shift_sheet !== false,
    };
  });

  const visibleMemberIds = new Set(
    members.filter((member) => member.showOnShiftSheet).map((member) => member.userId),
  );

  return {
    storeId: input.storeId,
    storeName: input.storeName,
    yearMonth: input.yearMonth,
    members: members.filter((member) => member.showOnShiftSheet),
    assignments: (assignmentRows ?? [])
      .filter((row) => visibleMemberIds.has(row.user_id))
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        workDate: row.work_date,
        startAt: row.start_at,
        endAt: row.end_at,
        breakMinutes: row.break_minutes ?? 0,
        roleLabel: row.role_label,
        note: row.note,
        timeSlotLabel: one(row.store_shift_time_slots)?.short_label ?? null,
      })),
  };
}

export async function fetchShiftAdjustmentWindows(input: {
  userId: string;
  tenantId: string;
  storeId?: string;
}): Promise<ShiftAdjustmentWindow[]> {
  const client = requireSupabase();
  let windowQuery = client
    .from('shift_adjustment_windows')
    .select(
      'id, store_id, shift_period_id, status, reason, opened_at, due_at, submitted_at, stores(name), shift_periods(name, start_date, end_date), shift_adjustment_entries(id, shift_assignment_id, work_date, request_type, desired_start_at, desired_end_at, note)',
    )
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .order('opened_at', { ascending: false });
  if (input.storeId) windowQuery = windowQuery.eq('store_id', input.storeId);

  const { data: windows, error: windowError } = await windowQuery;
  if (windowError) throw windowError;
  if (!windows?.length) return [];

  const periodIds = [...new Set(windows.map((window) => window.shift_period_id))];
  const { data: assignments, error: assignmentError } = await client
    .from('shift_assignments')
    .select(
      'id, store_id, shift_period_id, work_date, start_at, end_at, break_minutes, status, role_label, stores(name), shift_schedules!inner(is_published)',
    )
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .eq('shift_schedules.is_published', true)
    .in('shift_period_id', periodIds)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true });
  if (assignmentError) throw assignmentError;

  const assignmentsByPeriod = new Map<string, ShiftAssignment[]>();
  for (const row of assignments ?? []) {
    const items = assignmentsByPeriod.get(row.shift_period_id) ?? [];
    items.push({
      id: row.id,
      storeId: row.store_id,
      storeName: one(row.stores)?.name ?? '店舗',
      workDate: row.work_date,
      startAt: row.start_at,
      endAt: row.end_at,
      breakMinutes: row.break_minutes ?? 0,
      status: row.status,
      roleLabel: row.role_label,
    });
    assignmentsByPeriod.set(row.shift_period_id, items);
  }

  return windows.map((window) => {
    const period = one(window.shift_periods);
    return {
      id: window.id,
      storeId: window.store_id,
      storeName: one(window.stores)?.name ?? '店舗',
      periodId: window.shift_period_id,
      periodName: period?.name ?? 'シフト期間',
      periodStartDate: period?.start_date ?? '',
      periodEndDate: period?.end_date ?? '',
      status: window.status as ShiftAdjustmentWindow['status'],
      reason: window.reason,
      openedAt: window.opened_at,
      dueAt: window.due_at,
      submittedAt: window.submitted_at,
      assignments: assignmentsByPeriod.get(window.shift_period_id) ?? [],
      entries: (window.shift_adjustment_entries ?? [])
        .map((entry) => ({
          id: entry.id,
          assignmentId: entry.shift_assignment_id,
          workDate: entry.work_date,
          requestType: entry.request_type as ShiftAdjustmentRequestType,
          desiredStartAt: entry.desired_start_at,
          desiredEndAt: entry.desired_end_at,
          note: entry.note,
        }))
        .sort((a, b) => a.workDate.localeCompare(b.workDate)),
    };
  });
}

export async function addShiftAdjustmentEntry(input: {
  userId: string;
  tenantId: string;
  window: ShiftAdjustmentWindow;
  assignmentId: string | null;
  workDate: string;
  requestType: ShiftAdjustmentRequestType;
  desiredStartTime?: string;
  desiredEndTime?: string;
  note?: string;
}) {
  const client = requireSupabase();
  if (input.window.status !== 'open') {
    throw new Error('この修正希望は編集できません。');
  }
  if (
    input.workDate < input.window.periodStartDate ||
    input.workDate > input.window.periodEndDate
  ) {
    throw new Error('シフト期間内の日付を入力してください。');
  }
  const needsTime = input.requestType === 'change_time' || input.requestType === 'available';
  if (
    needsTime &&
    (!input.desiredStartTime ||
      !input.desiredEndTime ||
      !/^\d{2}:\d{2}$/.test(input.desiredStartTime) ||
      !/^\d{2}:\d{2}$/.test(input.desiredEndTime))
  ) {
    throw new Error('希望開始・終了を09:00の形式で入力してください。');
  }

  let desiredStartAt: string | null = null;
  let desiredEndAt: string | null = null;
  if (needsTime) {
    desiredStartAt = `${input.workDate}T${input.desiredStartTime}:00+09:00`;
    desiredEndAt = `${input.workDate}T${input.desiredEndTime}:00+09:00`;
    if (new Date(desiredEndAt) <= new Date(desiredStartAt)) {
      const next = new Date(`${input.workDate}T00:00:00+09:00`);
      next.setDate(next.getDate() + 1);
      const nextDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(next);
      desiredEndAt = `${nextDate}T${input.desiredEndTime}:00+09:00`;
    }
  }

  const { error } = await client.from('shift_adjustment_entries').insert({
    tenant_id: input.tenantId,
    adjustment_window_id: input.window.id,
    shift_assignment_id: input.assignmentId,
    work_date: input.workDate,
    request_type: input.requestType,
    desired_start_at: desiredStartAt,
    desired_end_at: desiredEndAt,
    note: input.note?.trim() || null,
  });
  if (error) throw error;
}

export async function deleteShiftAdjustmentEntry(input: {
  id: string;
  windowId: string;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from('shift_adjustment_entries')
    .delete()
    .eq('id', input.id)
    .eq('adjustment_window_id', input.windowId);
  if (error) throw error;
}

export async function submitShiftAdjustmentWindow(windowId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('submit_mobile_shift_adjustment', {
    p_window_id: windowId,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchOpenShiftPeriods(input: {
  userId: string;
  tenantId: string;
  storeId?: string;
}): Promise<OpenShiftPeriod[]> {
  const client = requireSupabase();
  let periodQuery = client
    .from('shift_periods')
    .select(
      'id, store_id, name, start_date, end_date, request_deadline_at, status, stores(name), shift_period_closed_days(work_date)',
    )
    .eq('tenant_id', input.tenantId)
    .eq('status', 'open')
    .gt('request_deadline_at', new Date().toISOString())
    .order('request_deadline_at', { ascending: true });

  if (input.storeId) periodQuery = periodQuery.eq('store_id', input.storeId);
  const { data: periods, error: periodError } = await periodQuery;
  if (periodError) throw periodError;
  if (!periods?.length) return [];

  const { data: requests, error: requestError } = await client
    .from('shift_requests')
    .select(
      'id, shift_period_id, submitted_at, shift_request_entries(id, work_date, entry_type, is_all_day, start_at, end_at, note)',
    )
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .in(
      'shift_period_id',
      periods.map((period) => period.id),
    );
  if (requestError) throw requestError;

  const requestByPeriod = new Map(
    (requests ?? []).map((request) => [request.shift_period_id, request]),
  );

  return periods.map((period) => {
    const request = requestByPeriod.get(period.id);
    const entries = (request?.shift_request_entries ?? []).map((entry) => ({
      id: entry.id,
      workDate: entry.work_date,
      entryType: entry.entry_type as ShiftRequestEntry['entryType'],
      isAllDay: entry.is_all_day,
      startAt: entry.start_at,
      endAt: entry.end_at,
      note: entry.note,
    }));
    return {
      id: period.id,
      storeId: period.store_id,
      storeName: one(period.stores)?.name ?? '店舗',
      name: period.name,
      startDate: period.start_date,
      endDate: period.end_date,
      requestDeadlineAt: period.request_deadline_at,
      requestId: request?.id ?? null,
      submittedAt: request?.submitted_at ?? null,
      entries,
      closedDates: (period.shift_period_closed_days ?? []).map((day) => day.work_date),
    };
  });
}

export async function fetchNotifications(input: {
  userId: string;
  tenantId: string;
}): Promise<StaffNotification[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notifications')
    .select('id, type, title, body, link_path, metadata, read_at, created_at')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.link_path,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(input: {
  id: string;
  userId: string;
  tenantId: string;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(input: {
  userId: string;
  tenantId: string;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function fetchHelpRequests(input: {
  userId: string;
  tenantId: string;
  storeIds: string[];
}): Promise<HelpRequest[]> {
  if (!input.storeIds.length) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('help_requests')
    .select(
      'id, store_id, title, description, work_date, start_at, end_at, required_count, stores(name), help_applications(id, user_id, status)',
    )
    .eq('tenant_id', input.tenantId)
    .eq('status', 'open')
    .in('store_id', input.storeIds)
    .gte('end_at', new Date().toISOString())
    .order('start_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const application = (row.help_applications ?? []).find(
      (item) => item.user_id === input.userId,
    );
    return {
      id: row.id,
      storeId: row.store_id,
      storeName: one(row.stores)?.name ?? '店舗',
      title: row.title,
      description: row.description,
      workDate: row.work_date,
      startAt: row.start_at,
      endAt: row.end_at,
      requiredCount: row.required_count,
      applicationId: application?.id ?? null,
      applicationStatus: application?.status ?? null,
    };
  });
}

export async function applyToHelpRequest(input: {
  requestId: string;
  userId: string;
  tenantId: string;
  message?: string;
}) {
  const client = requireSupabase();
  const { error } = await client.from('help_applications').insert({
    tenant_id: input.tenantId,
    help_request_id: input.requestId,
    user_id: input.userId,
    message: input.message || null,
    status: 'pending',
  });
  if (error) throw error;
}

export async function fetchActiveAttendanceRecord(input: {
  userId: string;
  tenantId: string;
  storeId: string;
}): Promise<AttendanceRecord | null> {
  const client = requireSupabase();
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: activeData, error: activeError } = await client
    .from('attendance_records')
    .select(
      'id, store_id, work_date, clock_in_at, clock_out_at, break_minutes, status, review_status, review_required_reason',
    )
    .eq('tenant_id', input.tenantId)
    .eq('store_id', input.storeId)
    .eq('user_id', input.userId)
    .eq('status', 'open')
    .gte('clock_in_at', cutoff)
    .order('clock_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;

  let data = activeData;
  if (!data) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const { data: latestData, error: latestError } = await client
      .from('attendance_records')
      .select(
        'id, store_id, work_date, clock_in_at, clock_out_at, break_minutes, status, review_status, review_required_reason',
      )
      .eq('tenant_id', input.tenantId)
      .eq('store_id', input.storeId)
      .eq('user_id', input.userId)
      .eq('work_date', today)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    data = latestData;
  }
  if (!data) return null;

  let isOnBreak = false;
  if (data.status === 'open') {
    const { data: latestBreak, error: breakError } = await client
      .from('attendance_events')
      .select('event_type')
      .eq('attendance_record_id', data.id)
      .in('event_type', ['break_start', 'break_end'])
      .order('event_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (breakError) throw breakError;
    isOnBreak = latestBreak?.event_type === 'break_start';
  }

  return {
    id: data.id,
    storeId: data.store_id,
    workDate: data.work_date,
    clockInAt: data.clock_in_at,
    clockOutAt: data.clock_out_at,
    breakMinutes: data.break_minutes ?? 0,
    status: data.status,
    reviewStatus: data.review_status,
    reviewRequiredReason: data.review_required_reason,
    isOnBreak,
  };
}

export async function recordAttendanceEvent(input: {
  storeId: string;
  eventType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  gpsStatus: 'ok' | 'denied' | 'unavailable' | 'not_supported';
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracyMeters?: number;
  reason?: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('record_mobile_attendance_event', {
    p_store_id: input.storeId,
    p_event_type: input.eventType,
    p_gps_status: input.gpsStatus,
    p_gps_lat: input.gpsLat ?? null,
    p_gps_lng: input.gpsLng ?? null,
    p_gps_accuracy_meters: input.gpsAccuracyMeters ?? null,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw error;
  return data as {
    record_id: string;
    event_type: string;
    evidence_status: string;
    review_status: string;
    distance_from_store_meters: number | null;
  };
}

export async function replaceShiftRequestEntries(input: {
  userId: string;
  tenantId: string;
  period: OpenShiftPeriod;
  entries: {
    workDate: string;
    entryType: ShiftRequestEntry['entryType'];
    isAllDay: boolean;
    startAt: string | null;
    endAt: string | null;
    note?: string | null;
  }[];
  affectedDates: string[];
}) {
  const client = requireSupabase();
  if (input.period.submittedAt) {
    throw new Error('提出済みの希望シフトは、下書きに戻してから編集してください。');
  }
  if (Date.now() >= new Date(input.period.requestDeadlineAt).getTime()) {
    throw new Error('この希望シフトの提出期限は終了しています。');
  }
  if (input.entries.some((entry) => input.period.closedDates.includes(entry.workDate))) {
    throw new Error('休業日には希望シフトを入力できません。');
  }

  const { data: request, error: requestError } = await client
    .from('shift_requests')
    .upsert(
      {
        tenant_id: input.tenantId,
        store_id: input.period.storeId,
        shift_period_id: input.period.id,
        user_id: input.userId,
      },
      { onConflict: 'shift_period_id,user_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (requestError || !request) throw requestError ?? new Error('希望シフトを作成できませんでした。');

  const { error } = await client.rpc('replace_shift_request_entries', {
    p_request_id: request.id,
    p_dates: input.affectedDates,
    p_rows: input.entries.map((entry) => ({
      work_date: entry.workDate,
      entry_type: entry.entryType,
      is_all_day: entry.isAllDay,
      start_at: entry.startAt,
      end_at: entry.endAt,
      note: entry.note ?? null,
      time_slot_id: null,
    })),
  });
  if (error) throw error;
}

export async function setShiftRequestSubmitted(input: {
  requestId: string;
  submitted: boolean;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from('shift_requests')
    .update({ submitted_at: input.submitted ? new Date().toISOString() : null })
    .eq('id', input.requestId);
  if (error) throw error;
}

export async function fetchNotificationPreferences(input: {
  userId: string;
  tenantId: string;
}): Promise<NotificationPreferences> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notification_preferences')
    .select(
      'in_app_enabled, email_enabled, shift_published_enabled, shift_changed_enabled, help_requested_enabled, payroll_published_enabled',
    )
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (error) throw error;
  return {
    inAppEnabled: data?.in_app_enabled ?? true,
    emailEnabled: data?.email_enabled ?? false,
    shiftPublishedEnabled: data?.shift_published_enabled ?? true,
    shiftChangedEnabled: data?.shift_changed_enabled ?? true,
    helpRequestedEnabled: data?.help_requested_enabled ?? true,
    payrollPublishedEnabled: data?.payroll_published_enabled ?? true,
  };
}

export async function updateNotificationPreferences(input: {
  userId: string;
  tenantId: string;
  preferences: NotificationPreferences;
}) {
  const client = requireSupabase();
  const { error } = await client.from('notification_preferences').upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      in_app_enabled: input.preferences.inAppEnabled,
      email_enabled: input.preferences.emailEnabled,
      shift_published_enabled: input.preferences.shiftPublishedEnabled,
      shift_changed_enabled: input.preferences.shiftChangedEnabled,
      help_requested_enabled: input.preferences.helpRequestedEnabled,
      payroll_published_enabled: input.preferences.payrollPublishedEnabled,
    },
    { onConflict: 'tenant_id,user_id' },
  );
  if (error) throw error;
}

export async function submitManualAttendance(input: {
  storeId: string;
  workDate: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  reason: string;
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('submit_mobile_manual_attendance', {
    p_store_id: input.storeId,
    p_work_date: input.workDate,
    p_clock_in: input.clockIn,
    p_clock_out: input.clockOut,
    p_break_minutes: input.breakMinutes,
    p_reason: input.reason.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function updateStaffProfile(input: {
  userId: string;
  displayName: string;
  phoneNumber: string | null;
}) {
  const client = requireSupabase();
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 100) {
    throw new Error('表示名は1〜100文字で入力してください。');
  }
  const phoneNumber = input.phoneNumber?.trim() || null;
  if (phoneNumber && phoneNumber.length > 30) {
    throw new Error('電話番号は30文字以内で入力してください。');
  }
  const { error } = await client
    .from('profiles')
    .update({ display_name: displayName, phone_number: phoneNumber })
    .eq('id', input.userId);
  if (error) throw error;
}
