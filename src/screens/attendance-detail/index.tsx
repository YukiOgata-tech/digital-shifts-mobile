import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  calculateDistanceMeters,
  getAttendanceLocation,
  type AttendanceLocationEvidence,
} from '@/features/attendance/location';
import { formatTime, toDateKey } from '@/features/staff/date';
import {
  useActiveAttendanceRecord,
  useAttendanceRecords,
  useRecordAttendanceEvent,
  useStaffIdentity,
} from '@/features/staff/queries';

const reasonOptions = ['通信が悪い', 'GPSを許可できない', '打刻を忘れた', 'その他'] as const;
type GpsState = AttendanceLocationEvidence | { status: 'checking' };

export function AttendanceDetailScreen() {
  const { storeId, source } = useLocalSearchParams<{ storeId: string; source?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const store = staff.stores.find((item) => item.id === storeId);
  const activeRecord = useActiveAttendanceRecord(storeId);
  const today = toDateKey(new Date());
  const todayRecords = useAttendanceRecords(today, today);
  const recordEvent = useRecordAttendanceEvent();
  const [gps, setGps] = useState<GpsState>({ status: 'checking' });
  const [now, setNow] = useState(() => new Date());
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const refreshLocation = async () => {
    setGps({ status: 'checking' });
    setGps(await getAttendanceLocation());
  };

  useEffect(() => {
    let active = true;
    void getAttendanceLocation().then((location) => {
      if (active) setGps(location);
    });
    return () => {
      active = false;
    };
  }, [storeId]);

  const distance = useMemo(() => {
    if (
      !store ||
      gps.status !== 'ok' ||
      gps.latitude == null ||
      gps.longitude == null ||
      store.attendanceLat == null ||
      store.attendanceLng == null
    ) {
      return null;
    }
    return calculateDistanceMeters(
      gps.latitude,
      gps.longitude,
      store.attendanceLat,
      store.attendanceLng,
    );
  }, [gps, store]);

  if (staff.isLoading || activeRecord.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="店舗の打刻状態を確認しています…" />
      </AppScreen>
    );
  }
  if (!store) {
    return (
      <AppScreen>
        <EmptyState
          title="打刻対象の店舗が見つかりません"
          description="所属解除または店舗停止の可能性があります。店舗一覧を再読み込みしてください。"
        />
      </AppScreen>
    );
  }
  if (activeRecord.isError) {
    return (
      <AppScreen>
        <ErrorState message={activeRecord.error.message} onRetry={() => void activeRecord.refetch()} />
      </AppScreen>
    );
  }

  const record = activeRecord.data;
  const isWorking = Boolean(record);
  const isOnBreak = Boolean(record?.isOnBreak);
  const isQr = source === 'qr';
  const hasStoreLocation = store.attendanceLat != null && store.attendanceLng != null;
  const isOutOfRange =
    distance != null && distance > store.attendanceGpsRadiusMeters;
  const locationOk =
    !hasStoreLocation || (gps.status === 'ok' && distance != null && !isOutOfRange);
  const suppressClockOutReason =
    isWorking && record?.reviewStatus === 'needs_review';
  const needsReason =
    !suppressClockOutReason &&
    gps.status !== 'checking' &&
    (!locationOk || gps.status !== 'ok');
  const isOtherReason = selectedReason === 'その他';
  const reason = [selectedReason, isOtherReason ? otherReason.trim() : '']
    .filter(Boolean)
    .join(' / ');
  const reasonComplete =
    !needsReason || (Boolean(selectedReason) && (!isOtherReason || Boolean(otherReason.trim())));
  const storeRecords = (todayRecords.data ?? []).filter((item) => item.storeId === store.id);
  const eventType = isWorking ? 'clock_out' : 'clock_in';

  const submitClock = () => {
    if (gps.status === 'checking' || !reasonComplete) return;
    const perform = () =>
      recordEvent.mutate(
        {
          storeId: store.id,
          eventType,
          gpsStatus: gps.status,
          gpsLat: gps.status === 'ok' ? gps.latitude : undefined,
          gpsLng: gps.status === 'ok' ? gps.longitude : undefined,
          gpsAccuracyMeters: gps.status === 'ok' ? gps.accuracyMeters : undefined,
          reason: needsReason ? reason : undefined,
        },
        {
          onSuccess: (result) => {
            setSelectedReason('');
            setOtherReason('');
            if (process.env.EXPO_OS === 'ios') {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert(
              result.review_status === 'needs_review'
                ? `${eventType === 'clock_in' ? '出勤' : '退勤'}を要確認として記録しました`
                : `${eventType === 'clock_in' ? '出勤' : '退勤'}を記録しました`,
            );
          },
          onError: (error) => Alert.alert('打刻できませんでした', error.message),
        },
      );

    if (eventType === 'clock_out' && isOnBreak) {
      Alert.alert(
        '休憩中のまま退勤しますか？',
        '現在時刻で休憩を終了し、そのまま退勤を記録します。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '休憩を終えて退勤', style: 'destructive', onPress: perform },
        ],
      );
      return;
    }
    perform();
  };

  const submitBreak = (eventType: 'break_start' | 'break_end') => {
    recordEvent.mutate(
      {
        storeId: store.id,
        eventType,
        gpsStatus: 'unavailable',
      },
      {
        onSuccess: () =>
          Alert.alert(eventType === 'break_start' ? '休憩を開始しました' : '休憩を終了しました'),
        onError: (error) => Alert.alert('休憩を記録できませんでした', error.message),
      },
    );
  };

  const currentTime = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const currentDate = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now);

  return (
    <AppScreen
      refreshing={activeRecord.isFetching || todayRecords.isFetching}
      onRefresh={() => {
        void activeRecord.refetch();
        void todayRecords.refetch();
        void refreshLocation();
      }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(staff)/(attendance)');
          }
        }}
        style={({ pressed }) => ({
          minHeight: 44,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          opacity: pressed ? 0.55 : 1,
        })}>
        <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '800' }}>店舗</Text>
        <Text style={{ color: theme.textSecondary }}>›</Text>
        <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '800' }}>
          {store.name}
        </Text>
        <Text style={{ color: theme.textSecondary }}>›</Text>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>打刻</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.md }}>
        <View
          style={{
            width: 46,
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 23,
            backgroundColor: theme.brand,
            boxShadow: '0 8px 18px rgba(5, 150, 105, 0.22)',
          }}>
          <SymbolView
            name="storefront"
            tintColor="#FFFFFF"
            style={{ width: 23, height: 23 }}
          />
        </View>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 23, fontWeight: '900' }}>
            {store.name}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>
            店舗コード: {store.code || '未設定'}
          </Text>
        </View>
      </View>

      <AttendanceStepRail gpsReady={gps.status !== 'checking'} />

      <View
        style={{
          padding: appSpacing.lg,
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: '#94A3B8',
          backgroundColor: theme.surface,
          boxShadow: '0 14px 30px rgba(51, 65, 85, 0.24)',
        }}>
        <View style={{ alignItems: 'center' }}>
          <Text
            selectable
            style={{
              color: theme.text,
              fontSize: 42,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
              letterSpacing: -1.5,
            }}>
            {currentTime}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '800' }}>
            {currentDate}
          </Text>
        </View>

        <WorkStatus record={record} now={now} />

        <View
          style={{
            flexDirection: 'row',
            borderRadius: appRadii.md,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.borderSoft,
            backgroundColor: theme.surfaceMuted,
            overflow: 'hidden',
          }}>
          <GpsSummary
            label={
              gps.status === 'checking'
                ? 'GPS確認中'
                : gps.status === 'ok'
                  ? 'GPS: 許可済み'
                  : 'GPS: 要確認'
            }
            symbol="location"
          />
          <View style={{ width: 1, backgroundColor: theme.borderSoft }} />
          <GpsSummary label={isQr ? 'QR: 有効' : '通常アクセス'} symbol="checkmark" />
        </View>

        <LocationPanel
          storeName={store.name}
          gps={gps}
          hasStoreLocation={hasStoreLocation}
          distance={distance}
          radius={store.attendanceGpsRadiusMeters}
          isOutOfRange={isOutOfRange}
          needsReason={needsReason}
          reasonSuppressed={suppressClockOutReason}
          selectedReason={selectedReason}
          otherReason={otherReason}
          onSelectReason={(value) => {
            setSelectedReason(value);
            if (value !== 'その他') setOtherReason('');
          }}
          onChangeOtherReason={setOtherReason}
          onRetry={() => void refreshLocation()}
        />

        {!isWorking ? (
          <ClockButton
            label="出勤を打刻する"
            tone="brand"
            loading={
              recordEvent.isPending &&
              recordEvent.variables?.eventType === 'clock_in'
            }
            disabled={recordEvent.isPending || gps.status === 'checking' || !reasonComplete}
            onPress={submitClock}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
            <ClockButton
              label={isOnBreak ? '休憩終了' : '休憩開始'}
              tone="warning"
              compact
              loading={
                recordEvent.isPending &&
                recordEvent.variables?.eventType ===
                  (isOnBreak ? 'break_end' : 'break_start')
              }
              disabled={recordEvent.isPending}
              onPress={() => submitBreak(isOnBreak ? 'break_end' : 'break_start')}
            />
            <ClockButton
              label="退勤を打刻する"
              tone="danger"
              compact
              loading={
                recordEvent.isPending &&
                recordEvent.variables?.eventType === 'clock_out'
              }
              disabled={recordEvent.isPending || gps.status === 'checking' || !reasonComplete}
              onPress={submitClock}
            />
          </View>
        )}

        <Text
          selectable
          style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
          打刻は本人のみ行えます。不正打刻は禁止されています。
        </Text>
      </View>

      <View
        style={{
          padding: appSpacing.lg,
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          backgroundColor: theme.surface,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900' }}>今日の記録</Text>
          <Pressable onPress={() => router.push(`/attendance/records?storeId=${store.id}`)}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '900' }}>
              ◷ 過去の記録
            </Text>
          </Pressable>
        </View>
        {storeRecords.length ? (
          storeRecords.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: appSpacing.md,
                padding: appSpacing.md,
                borderRadius: appRadii.md,
                backgroundColor: theme.surfaceMuted,
              }}>
              <Text style={{ color: item.clockOutAt ? theme.danger : theme.brand, fontWeight: '900' }}>
                {item.clockOutAt ? '退勤' : '出勤中'}
              </Text>
              <Text style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '900' }}>
                {formatTime(item.clockInAt)}
                {item.clockOutAt ? ` → ${formatTime(item.clockOutAt)}` : ''}
              </Text>
              <Text style={{ color: item.reviewStatus === 'needs_review' ? theme.warning : theme.brandStrong, fontSize: 11, fontWeight: '900' }}>
                {item.reviewStatus === 'needs_review' ? '要確認' : '確定'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
            今日の打刻記録はまだありません。
          </Text>
        )}
      </View>
    </AppScreen>
  );
}

function AttendanceStepRail({ gpsReady }: { gpsReady: boolean }) {
  const theme = useAppTheme();
  const steps = [
    ['qrcode', '1.QR読み取り', true],
    ['location', '2.位置情報確認', gpsReady],
    ['clock', '3.打刻', false],
    ['checkmark', '4.完了', false],
  ] as const;
  return (
    <View style={{ flexDirection: 'row' }}>
      {steps.map(([symbol, label, done], index) => (
        <View key={label} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, height: 2, backgroundColor: index ? '#94A3B8' : 'transparent' }} />
            <View
              style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 19,
                borderWidth: 4,
                borderColor: done ? theme.brandSoft : '#94A3B8',
                backgroundColor: theme.surface,
              }}>
              <SymbolView
                name={symbol}
                tintColor={done ? theme.brandStrong : theme.textSecondary}
                style={{ width: 20, height: 20 }}
              />
            </View>
            <View
              style={{ flex: 1, height: 2, backgroundColor: index < steps.length - 1 ? '#94A3B8' : 'transparent' }}
            />
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: theme.text, fontSize: 10, fontWeight: '900' }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function WorkStatus({
  record,
  now,
}: {
  record: ReturnType<typeof useActiveAttendanceRecord>['data'];
  now: Date;
}) {
  const theme = useAppTheme();
  if (!record) {
    return (
      <View style={{ padding: appSpacing.md, alignItems: 'center', borderRadius: appRadii.md, backgroundColor: theme.surfaceMuted }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>未出勤</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>出勤を打刻してください</Text>
      </View>
    );
  }
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(record.clockInAt).getTime()) / 60_000));
  const longWork = minutes >= 720;
  return (
    <View style={{ padding: appSpacing.md, alignItems: 'center', gap: 3, borderRadius: appRadii.md, backgroundColor: record.isOnBreak ? theme.warningSoft : theme.brandSoft }}>
      <Text style={{ color: record.isOnBreak ? theme.warning : theme.brandStrong, fontSize: 16, fontWeight: '900' }}>
        {record.isOnBreak ? '休憩中' : '出勤中'}
      </Text>
      <Text style={{ color: longWork ? theme.warning : theme.textSecondary, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
        {formatTime(record.clockInAt)} 出勤（{Math.floor(minutes / 60)}時間{minutes % 60}分経過）
        {longWork ? '\n退勤打刻を忘れていませんか？' : ''}
      </Text>
    </View>
  );
}

function GpsSummary({ label, symbol }: { label: string; symbol: 'location' | 'checkmark' }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      <SymbolView name={symbol} tintColor={theme.brand} style={{ width: 17, height: 17 }} />
      <Text style={{ color: theme.text, fontSize: 12, fontWeight: '900' }}>{label}</Text>
    </View>
  );
}

function LocationPanel({
  storeName,
  gps,
  hasStoreLocation,
  distance,
  radius,
  isOutOfRange,
  needsReason,
  reasonSuppressed,
  selectedReason,
  otherReason,
  onSelectReason,
  onChangeOtherReason,
  onRetry,
}: {
  storeName: string;
  gps: GpsState;
  hasStoreLocation: boolean;
  distance: number | null;
  radius: number;
  isOutOfRange: boolean;
  needsReason: boolean;
  reasonSuppressed: boolean;
  selectedReason: string;
  otherReason: string;
  onSelectReason: (value: string) => void;
  onChangeOtherReason: (value: string) => void;
  onRetry: () => void;
}) {
  const theme = useAppTheme();
  const locationOk = !hasStoreLocation || (distance != null && !isOutOfRange);
  const title = !hasStoreLocation
    ? '位置制限なしで打刻できます'
    : isOutOfRange
      ? '店舗付近ではありません'
      : gps.status === 'checking'
        ? '位置情報を確認しています'
        : gps.status !== 'ok'
          ? '位置情報を確認できません'
          : '店舗付近にいます';
  return (
    <View
      style={{
        padding: appSpacing.lg,
        gap: appSpacing.md,
        borderRadius: appRadii.md,
        borderWidth: 1,
        borderColor: locationOk ? '#A7F3D0' : '#FCD34D',
        backgroundColor: locationOk ? theme.brandSoft : theme.warningSoft,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.md }}>
        <View
          style={{
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 21,
            backgroundColor: locationOk ? theme.brand : '#F59E0B',
          }}>
          {gps.status === 'checking' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <SymbolView
              name={locationOk ? 'checkmark' : 'exclamationmark.triangle'}
              tintColor="#FFFFFF"
              style={{ width: 21, height: 21 }}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{title}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '800' }}>{storeName}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
            {!hasStoreLocation
              ? '通常記録されます'
              : distance == null
                ? `許容範囲: ${radius}m`
                : `現在地からの距離: ${Math.round(distance)}m（許容範囲: ${radius}m以内）`}
          </Text>
        </View>
        {gps.status !== 'checking' && gps.status !== 'ok' ? (
          <Pressable onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: theme.warning, fontSize: 12, fontWeight: '900' }}>再確認</Text>
          </Pressable>
        ) : null}
      </View>

      {needsReason ? (
        <View style={{ gap: appSpacing.sm, paddingTop: appSpacing.md, borderTopWidth: 1, borderTopColor: '#FCD34D' }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>
            打刻するには、理由を選んでください
          </Text>
          <Text style={{ color: theme.warning, fontSize: 11, fontWeight: '800' }}>
            この打刻は「要確認」として記録されます
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
            {reasonOptions.map((option) => {
              const selected = option === selectedReason;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectReason(option)}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: appSpacing.lg,
                    borderRadius: appRadii.pill,
                    borderWidth: 1,
                    borderColor: selected ? theme.warning : '#FCD34D',
                    backgroundColor: selected ? '#FDE68A' : theme.surface,
                  }}>
                  <Text style={{ color: theme.warning, fontSize: 13, fontWeight: '900' }}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {selectedReason === 'その他' ? (
            <>
              <TextInput
                autoFocus
                value={otherReason}
                maxLength={100}
                onChangeText={onChangeOtherReason}
                placeholder="具体的な理由を入力してください"
                placeholderTextColor={theme.textSecondary}
                style={{
                  minHeight: 48,
                  paddingHorizontal: appSpacing.md,
                  borderRadius: appRadii.sm,
                  borderWidth: 1,
                  borderColor: '#FCD34D',
                  backgroundColor: theme.surface,
                  color: theme.text,
                  fontSize: 14,
                }}
              />
              <Text style={{ color: theme.warning, fontSize: 11, textAlign: 'right' }}>{otherReason.length}/100</Text>
            </>
          ) : null}
        </View>
      ) : isOutOfRange && reasonSuppressed ? (
        <Text style={{ color: theme.warning, fontSize: 11, fontWeight: '800' }}>
          退勤は記録できます（出勤時の要確認として扱われます）
        </Text>
      ) : null}
    </View>
  );
}

function ClockButton({
  label,
  tone,
  compact = false,
  loading = false,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'brand' | 'danger' | 'warning';
  compact?: boolean;
  loading?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const background = tone === 'brand' ? theme.brand : tone === 'danger' ? theme.danger : '#F59E0B';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}、記録中` : label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: compact ? 1 : undefined,
        minHeight: compact ? 54 : 62,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: appSpacing.lg,
        borderRadius: appRadii.md,
        borderCurve: 'continuous',
        backgroundColor: background,
        opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        boxShadow: `0 8px 18px ${background}44`,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
        {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: '#FFFFFF', fontSize: compact ? 14 : 19, fontWeight: '900' }}>
          {loading ? '記録中…' : label}
        </Text>
      </View>
    </Pressable>
  );
}
