import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { PageIntro } from '@/components/ui/page-intro';
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
  const [locationIssue, setLocationIssue] = useState<AttendanceLocationEvidence['status'] | null>(
    null,
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

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
    second: '2-digit',
    hour12: false,
  }).format(now);

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
      setLocationIssue(location.status);
      Alert.alert(
        '理由を入力してください',
        '位置情報を確認できない場合は、画面下の理由欄への入力が必要です。',
      );
      return;
    }
    if (location.status === 'ok') setLocationIssue(null);

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
      <PageIntro
        eyebrow="Attendance"
        title="打刻"
        description={`${staff.activeStore.name}${
          staff.activeStore.code ? ` · 店舗コード ${staff.activeStore.code}` : ''
        }`}
        trailing={<StatusPill label={status.label} tone={status.tone} />}
      />

      <AttendanceProgress state={attendanceState} />

      <SectionCard
        style={{
          overflow: 'hidden',
          padding: 0,
          gap: 0,
          borderColor: '#94A3B8',
          boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
        }}>
        <View
          style={{
            width: '100%',
            alignItems: 'center',
            paddingHorizontal: appSpacing.lg,
            paddingVertical: appSpacing.xxl,
            gap: appSpacing.xs,
            backgroundColor: theme.hero,
          }}>
          <Text
            selectable
            style={{
              color: theme.brandBright,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.8,
              textTransform: 'uppercase',
            }}>
            Current time
          </Text>
          <Text
            selectable
            style={{
              color: theme.heroText,
              fontSize: 48,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
              letterSpacing: -1.8,
            }}>
            {currentTime}
          </Text>
          <Text selectable style={{ color: theme.heroMuted, fontSize: 14, fontWeight: '700' }}>
            {formatDateLabel(now, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </Text>
        </View>

        <View
          style={{
            width: '100%',
            padding: appSpacing.lg,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: appSpacing.md,
          }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              selectable
              style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '900' }}>
              本日の予定
            </Text>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: 20,
                fontWeight: '900',
                fontVariant: ['tabular-nums'],
              }}>
              {todayShift
                ? `${formatTime(todayShift.startAt)}–${formatTime(todayShift.endAt)}`
                : '予定なし'}
            </Text>
          </View>
          {todayShift?.roleLabel ? (
            <StatusPill label={todayShift.roleLabel} tone="brand" />
          ) : null}
        </View>

        <View
          style={{
            width: '100%',
            paddingHorizontal: appSpacing.lg,
            paddingBottom: appSpacing.lg,
            flexDirection: 'row',
            gap: appSpacing.sm,
          }}>
          {attendanceState === 'not-started' || attendanceState === 'finished' ? (
            <>
              <AttendanceActionButton
                label={recordEvent.isPending ? '確認中…' : '出勤'}
                englishLabel="CLOCK IN"
                icon="sf:arrow.right.circle.fill"
                disabled={recordEvent.isPending}
                onPress={() => void submit('clock_in')}
              />
              <AttendanceActionButton
                label="退勤"
                englishLabel="CLOCK OUT"
                icon="sf:arrow.left.circle"
                disabled
                tone="danger"
                onPress={() => {}}
              />
            </>
          ) : null}
          {attendanceState === 'working' ? (
            <>
              <AttendanceActionButton
                label="出勤済み"
                englishLabel="CLOCKED IN"
                icon="sf:checkmark.circle.fill"
                disabled
                onPress={() => {}}
              />
              <AttendanceActionButton
                label={recordEvent.isPending ? '確認中…' : '退勤'}
                englishLabel="CLOCK OUT"
                icon="sf:arrow.left.circle.fill"
                tone="danger"
                disabled={recordEvent.isPending}
                onPress={() => void submit('clock_out')}
              />
            </>
          ) : null}
          {attendanceState === 'on-break' ? (
            <AttendanceActionButton
                label="休憩を終了"
                englishLabel="BACK TO WORK"
                icon="sf:play.circle.fill"
                disabled={recordEvent.isPending}
                onPress={() => void submit('break_end')}
              />
          ) : null}
        </View>

        {attendanceState === 'working' ? (
          <View style={{ width: '100%', paddingHorizontal: appSpacing.lg }}>
            <NativeActionButton
              label="休憩を開始"
              variant="outlined"
              disabled={recordEvent.isPending}
              onPress={() => void submit('break_start')}
            />
          </View>
        ) : null}

        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: appSpacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.borderSoft,
          }}>
          <View style={{ gap: 2 }}>
            <Text selectable style={{ color: theme.brandStrong, fontSize: 13, fontWeight: '900' }}>
              位置情報を使用
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 11 }}>
              出勤・退勤を押した時だけ取得
            </Text>
          </View>
          <Text style={{ color: theme.brand, fontSize: 20, fontWeight: '900' }}>✓</Text>
        </View>
      </SectionCard>

      {locationIssue ? (
        <SectionCard tone="warning">
          <SectionHeading title="例外打刻の理由" />
          <Text selectable style={{ color: theme.warning, fontSize: 13, lineHeight: 19 }}>
            位置情報を確認できませんでした。理由を入力して、もう一度打刻してください。
          </Text>
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
              borderColor: '#FCD34D',
              backgroundColor: theme.surface,
              color: theme.text,
              fontSize: 15,
              textAlignVertical: 'top',
            }}
          />
        </SectionCard>
      ) : null}

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

function AttendanceActionButton({
  label,
  englishLabel,
  icon,
  tone = 'brand',
  disabled = false,
  onPress,
}: {
  label: string;
  englishLabel: string;
  icon: `sf:${string}`;
  tone?: 'brand' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const foreground = tone === 'danger' ? theme.danger : theme.brandStrong;
  const background = tone === 'danger' ? theme.dangerSoft : theme.brandSoft;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 82,
        padding: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: appSpacing.sm,
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: disabled ? theme.borderSoft : foreground,
        backgroundColor: disabled ? theme.surfaceMuted : background,
        opacity: pressed ? 0.72 : disabled ? 0.58 : 1,
      })}>
      {process.env.EXPO_OS === 'ios' ? (
        <Image
          source={icon}
          tintColor={disabled ? theme.textSecondary : foreground}
          style={{ width: 28, height: 28 }}
        />
      ) : (
        <Text style={{ color: disabled ? theme.textSecondary : foreground, fontSize: 24 }}>→</Text>
      )}
      <View style={{ gap: 1 }}>
        <Text
          style={{
            color: disabled ? theme.textSecondary : theme.text,
            fontSize: 17,
            fontWeight: '900',
          }}>
          {label}
        </Text>
        <Text
          style={{
            color: disabled ? theme.textSecondary : foreground,
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.5,
          }}>
          {englishLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function AttendanceProgress({ state }: { state: AttendanceState }) {
  const theme = useAppTheme();
  const currentStep = state === 'not-started' ? 2 : state === 'working' || state === 'on-break' ? 3 : 4;
  const steps = ['店舗', '位置情報', '打刻', '完了'];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 2 }}>
      {steps.map((label, index) => {
        const step = index + 1;
        const active = step <= currentStep;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: index === 0 ? 'transparent' : active ? theme.brand : theme.border,
                }}
              />
              <View
                style={{
                  width: 28,
                  height: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: active ? theme.brand : theme.border,
                  backgroundColor: active ? theme.brandSoft : theme.surface,
                }}>
                <Text
                  style={{
                    color: active ? theme.brandStrong : theme.textSecondary,
                    fontSize: 11,
                    fontWeight: '900',
                  }}>
                  {step}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor:
                    index === steps.length - 1
                      ? 'transparent'
                      : step < currentStep
                        ? theme.brand
                        : theme.border,
                }}
              />
            </View>
            <Text
              selectable
              style={{
                marginTop: 5,
                color: active ? theme.text : theme.textSecondary,
                fontSize: 10,
                fontWeight: '800',
              }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
