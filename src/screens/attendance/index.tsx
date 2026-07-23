import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  getAttendanceLocation,
  type AttendanceLocationEvidence,
} from '@/features/attendance/location';
import { formatDateLabel, formatTime, toDateKey } from '@/features/staff/date';
import {
  useActiveAttendanceRecord,
  useAssignments,
  useRecordAttendanceEvent,
  useStaffIdentity,
} from '@/features/staff/queries';

type AttendanceState = 'not-started' | 'working' | 'on-break' | 'finished';

export function AttendanceScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const record = useActiveAttendanceRecord();
  const assignments = useAssignments(1, 1);
  const recordEvent = useRecordAttendanceEvent();
  const [reason, setReason] = useState('');

  const attendanceState: AttendanceState = useMemo(() => {
    if (!record.data) return 'not-started';
    if (record.data.status !== 'open') return 'finished';
    return record.data.isOnBreak ? 'on-break' : 'working';
  }, [record.data]);

  const status = {
    'not-started': { label: '出勤前', tone: 'neutral' as const },
    working: { label: '勤務中', tone: 'brand' as const },
    'on-break': { label: '休憩中', tone: 'warning' as const },
    finished: { label: '退勤済み', tone: 'info' as const },
  }[attendanceState];
  const todayShift = assignments.data?.find((shift) => shift.workDate === toDateKey(new Date()));
  const currentTime = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  if (staff.isLoading || record.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="勤怠状態を確認しています…" />
      </AppScreen>
    );
  }
  if (!staff.activeStore) {
    return (
      <AppScreen>
        <EmptyState
          title="打刻できる店舗がありません"
          description="有効な店舗所属が見つかりません。管理者に所属状態を確認してもらってください。"
        />
      </AppScreen>
    );
  }
  if (record.isError) {
    return (
      <AppScreen>
        <ErrorState message={record.error.message} onRetry={() => void record.refetch()} />
      </AppScreen>
    );
  }

  const submit = async (
    eventType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end',
  ) => {
    const requiresLocation = eventType === 'clock_in' || eventType === 'clock_out';
    const location: AttendanceLocationEvidence = requiresLocation
      ? await getAttendanceLocation()
      : { status: 'unavailable' };

    if (requiresLocation && location.status !== 'ok' && !reason.trim()) {
      Alert.alert(
        '理由を入力してください',
        '位置情報を確認できない場合は、画面下の理由欄への入力が必要です。',
      );
      return;
    }

    recordEvent.mutate(
      {
        storeId: staff.activeStore!.id,
        eventType,
        gpsStatus: location.status,
        gpsLat: location.latitude,
        gpsLng: location.longitude,
        gpsAccuracyMeters: location.accuracyMeters,
        reason,
      },
      {
        onSuccess: (result) => {
          setReason('');
          const needsReview = result.review_status === 'needs_review';
          Alert.alert(
            needsReview ? '打刻しました（要確認）' : '打刻しました',
            needsReview
              ? '位置情報または打刻条件を確認できなかったため、管理者の確認対象になりました。'
              : '勤怠へ保存されました。',
          );
        },
        onError: (error) => Alert.alert('打刻できませんでした', error.message),
      },
    );
  };

  return (
    <AppScreen
      refreshing={record.isFetching || assignments.isFetching}
      onRefresh={() => {
        void record.refetch();
        void assignments.refetch();
      }}>
      <SectionCard style={{ alignItems: 'center', paddingVertical: appSpacing.xxxl }}>
        <StatusPill label={status.label} tone={status.tone} />
        <Text
          selectable
          style={{
            color: theme.text,
            fontSize: 52,
            fontWeight: '300',
            fontVariant: ['tabular-nums'],
            letterSpacing: -1,
          }}>
          {currentTime}
        </Text>
        <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
          {formatDateLabel(new Date(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </Text>
        <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
          {staff.activeStore.name}
        </Text>
      </SectionCard>

      <SectionCard tone="brand">
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <View style={{ flex: 1, gap: appSpacing.xs }}>
            <Text selectable style={{ color: theme.brandStrong, fontSize: 13, fontWeight: '700' }}>
              本日の予定
            </Text>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: 24,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}>
              {todayShift
                ? `${formatTime(todayShift.startAt)}–${formatTime(todayShift.endAt)}`
                : '予定なし'}
            </Text>
          </View>
          {todayShift?.roleLabel ? (
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              {todayShift.roleLabel}
            </Text>
          ) : null}
        </View>
      </SectionCard>

      <View style={{ gap: appSpacing.md }}>
        {attendanceState === 'not-started' || attendanceState === 'finished' ? (
          <NativeActionButton
            label={recordEvent.isPending ? '位置を確認中…' : '出勤する'}
            haptic="success"
            disabled={recordEvent.isPending}
            onPress={() => void submit('clock_in')}
          />
        ) : null}
        {attendanceState === 'working' ? (
          <>
            <NativeActionButton
              label="休憩を開始"
              disabled={recordEvent.isPending}
              onPress={() => void submit('break_start')}
            />
            <NativeActionButton
              label={recordEvent.isPending ? '位置を確認中…' : '退勤する'}
              variant="outlined"
              haptic="success"
              disabled={recordEvent.isPending}
              onPress={() => void submit('clock_out')}
            />
          </>
        ) : null}
        {attendanceState === 'on-break' ? (
          <NativeActionButton
            label="休憩を終了"
            haptic="success"
            disabled={recordEvent.isPending}
            onPress={() => void submit('break_end')}
          />
        ) : null}
      </View>

      <View style={{ gap: appSpacing.md }}>
        <SectionHeading title="位置情報を取得できない場合" />
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          multiline
          placeholder="例: 店舗内ですが端末の位置情報を取得できません"
          placeholderTextColor={theme.textSecondary}
          style={{
            minHeight: 88,
            padding: appSpacing.lg,
            borderRadius: appRadii.md,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
            fontSize: 15,
            textAlignVertical: 'top',
          }}
        />
        <Text selectable style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
          位置情報は出勤・退勤ボタンを押した時だけ取得します。範囲外や取得不可の打刻は、理由とともに管理者の確認対象になります。
        </Text>
      </View>

      {record.data?.reviewStatus === 'needs_review' ? (
        <SectionCard tone="warning">
          <Text selectable style={{ color: theme.warning, fontSize: 15, fontWeight: '700' }}>
            管理者の確認が必要です
          </Text>
          {record.data.reviewRequiredReason ? (
            <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
              {record.data.reviewRequiredReason}
            </Text>
          ) : null}
        </SectionCard>
      ) : null}

      <NativeActionButton
        label="打刻の修正について確認"
        variant="text"
        onPress={() => router.push('/attendance-adjustment')}
      />
    </AppScreen>
  );
}
