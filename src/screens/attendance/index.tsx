import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { PageIntro } from '@/components/ui/page-intro';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  calculateDistanceMeters,
  getAttendanceLocation,
} from '@/features/attendance/location';
import {
  useAttendanceStoreStatuses,
  useRecordAttendanceEvent,
  useStaffIdentity,
} from '@/features/staff/queries';
import type { AttendanceRecord, StaffStore } from '@/features/staff/types';

export function AttendanceScreen() {
  const router = useRouter();
  const staff = useStaffIdentity();
  const statuses = useAttendanceStoreStatuses();
  const statusByStore = new Map(
    (statuses.data ?? []).map((status) => [status.storeId, status.record]),
  );

  if (staff.isLoading || statuses.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="打刻できる店舗を確認しています…" />
      </AppScreen>
    );
  }
  if (staff.error || statuses.isError) {
    return (
      <AppScreen>
        <ErrorState
          message={staff.error?.message ?? statuses.error?.message ?? '店舗を読み込めませんでした。'}
          onRetry={() => {
            void staff.refresh();
            void statuses.refetch();
          }}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      refreshing={statuses.isFetching}
      onRefresh={() => {
        void staff.refresh();
        void statuses.refetch();
      }}>
      <PageIntro
        eyebrow="Attendance"
        title="打刻"
        description="店舗での出勤/退勤を記録します。"
      />

      {staff.stores.length ? (
        <View style={{ gap: appSpacing.md }}>
          {staff.stores.map((store) => (
            <AttendanceStoreCard
              key={store.id}
              store={store}
              record={statusByStore.get(store.id) ?? null}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="打刻できる店舗がありません"
          description="有効な店舗所属がある場合に、この画面から打刻できます。"
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="過去の打刻記録を確認・修正"
        onPress={() => router.push('/attendance/records')}
        style={({ pressed }) => ({
          minHeight: 52,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: appSpacing.sm,
          paddingHorizontal: appSpacing.lg,
          borderRadius: appRadii.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: '#CBD5E1',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.10)',
          opacity: pressed ? 0.72 : 1,
        })}>
        {process.env.EXPO_OS === 'ios' ? (
          <SymbolView
            name="clock.arrow.circlepath"
            tintColor="#64748B"
            style={{ width: 20, height: 20 }}
          />
        ) : (
          <Text style={{ color: '#64748B', fontSize: 18 }}>◷</Text>
        )}
        <Text style={{ color: '#475569', fontSize: 14, fontWeight: '900' }}>
          過去の打刻記録を確認・修正
        </Text>
      </Pressable>
    </AppScreen>
  );
}

function AttendanceStoreCard({
  store,
  record,
}: {
  store: StaffStore;
  record: AttendanceRecord | null;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const recordEvent = useRecordAttendanceEvent();
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const isWorking = Boolean(record);
  const openDetail = () => router.push(`/attendance/${store.id}`);

  const quickClock = async () => {
    if (isCheckingLocation || recordEvent.isPending) return;
    setIsCheckingLocation(true);
    const location = await getAttendanceLocation();
    setIsCheckingLocation(false);

    if (
      location.status !== 'ok' ||
      location.latitude == null ||
      location.longitude == null
    ) {
      Alert.alert(
        '位置情報を確認できません',
        '要確認の理由を選択するため、店舗別の詳細打刻画面へ移動します。',
        [{ text: '詳細へ進む', onPress: openDetail }],
      );
      return;
    }

    const distance =
      store.attendanceLat != null && store.attendanceLng != null
        ? calculateDistanceMeters(
            location.latitude,
            location.longitude,
            store.attendanceLat,
            store.attendanceLng,
          )
        : null;
    if (distance != null && distance > store.attendanceGpsRadiusMeters) {
      Alert.alert(
        '店舗付近ではありません',
        `現在地から約${Math.round(distance)}m離れています。理由を選択して打刻してください。`,
        [{ text: '詳細へ進む', onPress: openDetail }],
      );
      return;
    }

    recordEvent.mutate(
      {
        storeId: store.id,
        eventType: isWorking ? 'clock_out' : 'clock_in',
        gpsStatus: 'ok',
        gpsLat: location.latitude,
        gpsLng: location.longitude,
        gpsAccuracyMeters: location.accuracyMeters,
      },
      {
        onSuccess: () => {
          if (process.env.EXPO_OS === 'ios') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          Alert.alert(
            isWorking ? '退勤を記録しました' : '出勤を記録しました',
            `${store.name}の勤怠へ保存されました。`,
          );
        },
        onError: (error) => {
          const needsDetail = /reason required|GPS|位置情報|範囲外/i.test(error.message);
          Alert.alert(
            '一覧から打刻できませんでした',
            needsDetail
              ? '位置情報の確認が必要です。店舗別の詳細打刻画面から理由を選択してください。'
              : error.message,
            needsDetail ? [{ text: '詳細へ進む', onPress: openDetail }] : undefined,
          );
        },
      },
    );
  };

  const isBusy = isCheckingLocation || recordEvent.isPending;

  return (
    <View
      style={{
        padding: appSpacing.lg,
        gap: appSpacing.md,
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        backgroundColor: theme.surface,
        boxShadow: '0 12px 26px rgba(51, 65, 85, 0.22)',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: appRadii.md,
            borderCurve: 'continuous',
            backgroundColor: theme.brandSoft,
          }}>
          {process.env.EXPO_OS === 'ios' ? (
            <SymbolView
              name="storefront"
              tintColor={theme.brandStrong}
              style={{ width: 25, height: 25 }}
            />
          ) : (
            <Text style={{ color: theme.brandStrong, fontSize: 22 }}>店</Text>
          )}
        </View>

        <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: theme.text, fontSize: 19, fontWeight: '900' }}>
            {store.name}
          </Text>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: theme.textSecondary, fontSize: 13 }}>
            {store.code || 'コード未設定'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${store.name}で${isWorking ? '退勤' : '出勤'}する`}
          disabled={isBusy}
          onPress={() => void quickClock()}
          style={({ pressed }) => ({
            minWidth: 142,
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: appSpacing.sm,
            paddingHorizontal: appSpacing.lg,
            borderRadius: appRadii.lg,
            borderCurve: 'continuous',
            backgroundColor: isWorking ? theme.danger : theme.brand,
            boxShadow: isWorking
              ? '0 8px 18px rgba(225, 29, 72, 0.24)'
              : '0 8px 18px rgba(5, 150, 105, 0.28)',
            opacity: isBusy ? 0.5 : pressed ? 0.75 : 1,
          })}>
          {process.env.EXPO_OS === 'ios' ? (
            <SymbolView
              name={isWorking ? 'arrow.left.circle.fill' : 'rectangle.portrait.and.arrow.right'}
              tintColor="#FFFFFF"
              style={{ width: 21, height: 21 }}
            />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 20 }}>→</Text>
          )}
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
            {isBusy ? '確認中…' : isWorking ? '退勤' : '出勤'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
        <View
          style={{
            paddingHorizontal: appSpacing.md,
            paddingVertical: 5,
            borderRadius: appRadii.pill,
            backgroundColor: isWorking ? theme.dangerSoft : theme.brandSoft,
          }}>
          <Text
            style={{
              color: isWorking ? theme.danger : theme.brandStrong,
              fontSize: 12,
              fontWeight: '900',
            }}>
            {isWorking ? '出勤中' : '未出勤'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={openDetail}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            opacity: pressed ? 0.55 : 1,
          })}>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '900' }}>
            詳細
          </Text>
          <Image
            source="sf:arrow.up.right"
            tintColor={theme.textSecondary}
            style={{ width: 12, height: 12 }}
          />
        </Pressable>
      </View>
    </View>
  );
}
