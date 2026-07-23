export type StaffShift = {
  id: string;
  dateLabel: string;
  weekday: string;
  time: string;
  storeName: string;
  role?: string;
  status: 'published' | 'requested' | 'draft';
};

export type StaffNotice = {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  unread: boolean;
  tone: 'info' | 'warning' | 'success';
};

export const demoStaff = {
  displayName: 'スタッフ',
  storeName: 'Dミセ 渋谷店',
  todayShift: {
    start: '11:00',
    end: '19:00',
    breakMinutes: 60,
    role: 'ホール',
  },
  submissionDeadline: '明日 23:59',
} as const;

export const demoUpcomingShifts: StaffShift[] = [
  {
    id: 'shift-1',
    dateLabel: '7月25日',
    weekday: '土',
    time: '11:00–19:00',
    storeName: 'Dミセ 渋谷店',
    role: 'ホール',
    status: 'published',
  },
  {
    id: 'shift-2',
    dateLabel: '7月27日',
    weekday: '月',
    time: '17:00–22:00',
    storeName: 'Dミセ 渋谷店',
    role: 'ホール',
    status: 'published',
  },
  {
    id: 'shift-3',
    dateLabel: '7月30日',
    weekday: '木',
    time: '10:00–16:00',
    storeName: 'Dミセ 渋谷店',
    role: '仕込み',
    status: 'published',
  },
];

export const demoRequestedShifts: StaffShift[] = [
  {
    id: 'request-1',
    dateLabel: '8月1日',
    weekday: '土',
    time: '11:00–20:00',
    storeName: 'Dミセ 渋谷店',
    status: 'requested',
  },
  {
    id: 'request-2',
    dateLabel: '8月3日',
    weekday: '月',
    time: '休み希望',
    storeName: 'Dミセ 渋谷店',
    status: 'requested',
  },
  {
    id: 'request-3',
    dateLabel: '8月5日',
    weekday: '水',
    time: '17:00–22:00',
    storeName: 'Dミセ 渋谷店',
    status: 'draft',
  },
];

export const demoNotices: StaffNotice[] = [
  {
    id: 'notice-1',
    title: '8月前半の希望シフト提出',
    body: '提出期限は明日23:59です。未入力の日付を確認してください。',
    timeLabel: '10分前',
    unread: true,
    tone: 'warning',
  },
  {
    id: 'notice-2',
    title: 'シフトが公開されました',
    body: '7月25日から7月31日までの勤務を確認できます。',
    timeLabel: '昨日',
    unread: true,
    tone: 'success',
  },
  {
    id: 'notice-3',
    title: '勤怠修正が承認されました',
    body: '7月18日の退勤時刻が21:10に修正されました。',
    timeLabel: '3日前',
    unread: false,
    tone: 'info',
  },
];
