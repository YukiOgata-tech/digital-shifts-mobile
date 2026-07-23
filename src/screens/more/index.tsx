import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { ListRow } from '@/components/ui/list-row';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { useNotifications, useStaffIdentity } from '@/features/staff/queries';
import { env } from '@/lib/env';

function LeadingMark({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: appRadii.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
      }}>
      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

export function MoreScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const notifications = useNotifications();
  const unreadCount = notifications.data?.filter((notice) => !notice.readAt).length ?? 0;

  return (
    <AppScreen
      refreshing={staff.isLoading || notifications.isFetching}
      onRefresh={() => {
        void staff.refresh();
        void notifications.refetch();
      }}>
      <SectionCard tone="brand">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.md }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.brand,
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '800' }}>
              {(staff.profile?.displayName ?? 'ス').slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: theme.text, fontSize: 19, fontWeight: '700' }}>
              {staff.profile?.displayName ?? 'スタッフ'}
            </Text>
            <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
              {staff.activeStore?.name ?? staff.activeTenant?.name}
            </Text>
          </View>
          <StatusPill label={staff.activeTenant?.role === 'staff' ? 'スタッフ' : '管理者'} tone="brand" />
        </View>
      </SectionCard>

      <View style={{ gap: appSpacing.sm }}>
        <ListRow
          title="通知"
          subtitle={unreadCount ? `未読のお知らせが${unreadCount}件あります` : '未読はありません'}
          leading={<LeadingMark label="通知" color={theme.danger} />}
          trailing={unreadCount ? <StatusPill label={`${unreadCount}`} tone="danger" /> : undefined}
          onPress={() => router.push('/notifications')}
        />
        <ListRow
          title="ヘルプ募集"
          subtitle="所属店舗の応援募集を確認"
          leading={<LeadingMark label="募集" color={theme.info} />}
          onPress={() => router.push('/help')}
        />
        <ListRow
          title="勤怠の確認"
          subtitle="打刻状態と要確認理由を確認"
          leading={<LeadingMark label="勤怠" color={theme.warning} />}
          onPress={() => router.push('/attendance-adjustment')}
        />
      </View>

      <View style={{ gap: appSpacing.sm }}>
        <ListRow
          title="プロフィールと設定"
          subtitle="店舗、通知、アカウント設定"
          leading={<LeadingMark label="設定" color={theme.brand} />}
          onPress={() => router.push('/profile')}
        />
      </View>

      <Text
        selectable
        style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center', paddingTop: 8 }}>
        {env.appName} モバイル 1.0.0
      </Text>
    </AppScreen>
  );
}
