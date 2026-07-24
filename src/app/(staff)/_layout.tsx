import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { useNotifications, useStaffIdentity } from '@/features/staff/queries';

type StaffTab = {
  name: string;
  href:
    | '/(staff)/(home)'
    | '/(staff)/(stores)'
    | '/(staff)/(shifts)'
    | '/(staff)/(attendance)'
    | '/(staff)/(notifications)'
    | '/(staff)/(settings)';
  label: string;
  fallback: string;
  icon: `sf:${string}`;
  selectedIcon: `sf:${string}`;
  badge?: number;
};

export default function StaffTabLayout() {
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const notifications = useNotifications();
  const unreadCount = notifications.data?.filter((notice) => !notice.readAt).length ?? 0;
  const tabs: StaffTab[] = [
    {
      name: 'home',
      href: '/(staff)/(home)',
      label: 'ホーム',
      fallback: '家',
      icon: 'sf:house',
      selectedIcon: 'sf:house.fill',
    },
    {
      name: 'stores',
      href: '/(staff)/(stores)',
      label: '店舗',
      fallback: '店',
      icon: 'sf:storefront',
      selectedIcon: 'sf:storefront.fill',
    },
    {
      name: 'shifts',
      href: '/(staff)/(shifts)',
      label: 'シフト',
      fallback: '暦',
      icon: 'sf:calendar',
      selectedIcon: 'sf:calendar.circle.fill',
    },
    {
      name: 'attendance',
      href: '/(staff)/(attendance)',
      label: '打刻',
      fallback: '刻',
      icon: 'sf:clock',
      selectedIcon: 'sf:clock.fill',
    },
    {
      name: 'notifications',
      href: '/(staff)/(notifications)',
      label: '通知',
      fallback: '知',
      icon: 'sf:bell',
      selectedIcon: 'sf:bell.fill',
      badge: unreadCount,
    },
    {
      name: 'settings',
      href: '/(staff)/(settings)',
      label: '設定',
      fallback: '設',
      icon: 'sf:gearshape',
      selectedIcon: 'sf:gearshape.fill',
    },
  ];

  return (
    <Tabs style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.surface }}>
        <View
          style={{
            minHeight: 62,
            paddingHorizontal: appSpacing.lg,
            paddingVertical: appSpacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: appSpacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.borderSoft,
          }}>
          <View
            style={{
              width: 42,
              height: 42,
              padding: 3,
              borderRadius: appRadii.md,
              borderCurve: 'continuous',
              backgroundColor: theme.brandSoft,
            }}>
            <Image
              source={require('@/assets/images/brand/dmise-logo.png')}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text
              selectable
              style={{
                color: theme.brandStrong,
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
              }}>
              Dミセ
            </Text>
            <Text
              selectable
              numberOfLines={1}
              style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>
              {staff.activeTenant?.name ?? 'スタッフアプリ'}
            </Text>
            <Text
              selectable
              numberOfLines={1}
              style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '700' }}>
              {staff.activeStore?.name ?? staff.profile?.email ?? '所属情報を確認中'}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: appSpacing.md,
              paddingVertical: 7,
              borderRadius: appRadii.pill,
              backgroundColor: theme.brandSoft,
            }}>
            <Text style={{ color: theme.brandStrong, fontSize: 10, fontWeight: '900' }}>
              STAFF
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <TabSlot style={{ flex: 1, backgroundColor: theme.background }} />

      <TabList asChild>
        <SafeAreaView
          edges={['bottom']}
          style={{
            flexDirection: 'row',
            backgroundColor: theme.tabBackground,
            borderTopWidth: 1,
            borderTopColor: theme.borderSoft,
            boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.07)',
          }}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} resetOnFocus asChild>
              <StaffTabButton {...tab} />
            </TabTrigger>
          ))}
        </SafeAreaView>
      </TabList>
    </Tabs>
  );
}

type StaffTabButtonProps = TabTriggerSlotProps & StaffTab;

function StaffTabButton({
  isFocused = false,
  href: _href,
  label,
  fallback,
  icon,
  selectedIcon,
  badge = 0,
  ...pressableProps
}: StaffTabButtonProps) {
  const theme = useAppTheme();
  void _href;

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={label}
      onPress={(event) => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        pressableProps.onPress?.(event);
      }}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 62,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        opacity: pressed ? 0.65 : 1,
      })}>
      <View
        style={{
          position: 'relative',
          minWidth: 38,
          height: 30,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: appSpacing.sm,
          borderRadius: appRadii.md,
          backgroundColor: isFocused ? theme.brandSoft : 'transparent',
        }}>
        {process.env.EXPO_OS === 'ios' ? (
          <Image
            source={isFocused ? selectedIcon : icon}
            contentFit="contain"
            tintColor={isFocused ? theme.brandStrong : theme.textSecondary}
            style={{ width: 21, height: 21 }}
          />
        ) : (
          <Text
            style={{
              color: isFocused ? theme.brandStrong : theme.textSecondary,
              fontSize: 13,
              fontWeight: '900',
            }}>
            {fallback}
          </Text>
        )}
        {badge > 0 ? (
          <View
            style={{
              position: 'absolute',
              right: -2,
              top: -4,
              minWidth: 17,
              height: 17,
              paddingHorizontal: 4,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: appRadii.pill,
              backgroundColor: theme.danger,
              borderWidth: 2,
              borderColor: theme.surface,
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900' }}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: isFocused ? theme.brandStrong : theme.textSecondary,
          fontSize: 9,
          fontWeight: '900',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
