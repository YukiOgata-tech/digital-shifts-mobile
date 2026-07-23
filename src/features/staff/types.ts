export type StaffProfile = {
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  timezone: string;
};

export type StaffTenant = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'manager' | 'staff';
};

export type StaffStore = {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  address: string | null;
  timezone: string;
  role: string;
  attendanceLat: number | null;
  attendanceLng: number | null;
  attendanceGpsRadiusMeters: number;
};

export type StaffContextData = {
  profile: StaffProfile;
  tenants: StaffTenant[];
  stores: StaffStore[];
};

export type ShiftAssignment = {
  id: string;
  storeId: string;
  storeName: string;
  workDate: string;
  startAt: string;
  endAt: string;
  breakMinutes: number;
  status: string;
  roleLabel: string | null;
};

export type ShiftRequestEntry = {
  id: string;
  workDate: string;
  entryType: 'available' | 'unavailable' | 'preferred';
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  note: string | null;
};

export type OpenShiftPeriod = {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  startDate: string;
  endDate: string;
  requestDeadlineAt: string;
  requestId: string | null;
  submittedAt: string | null;
  entries: ShiftRequestEntry[];
  closedDates: string[];
};

export type StaffNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type HelpRequest = {
  id: string;
  storeId: string;
  storeName: string;
  title: string;
  description: string | null;
  workDate: string;
  startAt: string;
  endAt: string;
  requiredCount: number;
  applicationId: string | null;
  applicationStatus: string | null;
};

export type AttendanceRecord = {
  id: string;
  storeId: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  breakMinutes: number;
  status: string;
  reviewStatus: string | null;
  reviewRequiredReason: string | null;
  isOnBreak: boolean;
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  shiftPublishedEnabled: boolean;
  shiftChangedEnabled: boolean;
  helpRequestedEnabled: boolean;
  payrollPublishedEnabled: boolean;
};
