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

      <NativeTabs.Trigger name="(more)" role="more">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }}
          md="more_horiz"
        />
        <NativeTabs.Trigger.Label>その他</NativeTabs.Trigger.Label>
        {unreadCount ? <NativeTabs.Trigger.Badge>{`${unreadCount}`}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
