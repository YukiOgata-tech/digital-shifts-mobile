import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppTheme } from '@/constants/app-theme';
import { useNotifications } from '@/features/staff/queries';

export default function StaffTabLayout() {
  const theme = useAppTheme();
  const notifications = useNotifications();
  const unreadCount = notifications.data?.filter((notice) => !notice.readAt).length ?? 0;

  return (
    <NativeTabs
      backgroundColor={theme.tabBackground}
      badgeBackgroundColor={theme.danger}
      indicatorColor={theme.brandSoft}
      tintColor={theme.brand}
      minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md="home"
        />
        <NativeTabs.Trigger.Label>ホーム</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(shifts)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar.circle.fill' }}
          md="calendar_month"
        />
        <NativeTabs.Trigger.Label>シフト</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(attendance)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'clock', selected: 'clock.fill' }}
          md="schedule"
        />
        <NativeTabs.Trigger.Label>打刻</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(notifications)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bell', selected: 'bell.fill' }}
          md="notifications"
        />
        <NativeTabs.Trigger.Label>通知</NativeTabs.Trigger.Label>
        {unreadCount ? <NativeTabs.Trigger.Badge>{`${unreadCount}`}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
