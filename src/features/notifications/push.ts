import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

const DEVICE_ID_KEY = 'dmise-mobile-device-id';
export const STAFF_NOTIFICATION_CHANNEL = 'staff-updates';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
  return next;
}

function getProjectId() {
  return (
    env.easProjectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export async function registerPushNotifications(input: {
  userId: string;
  tenantId: string;
  requestPermission: boolean;
}) {
  if (!env.pushNotificationsEnabled) {
    throw new Error('Push通知は環境変数で有効化されていません。');
  }
  if (!supabase) throw new Error('Supabaseが設定されていません。');
  if (Platform.OS === 'web') throw new Error('WebではPush通知を登録できません。');
  if (!Device.isDevice) throw new Error('Push通知の登録は実機で行ってください。');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(STAFF_NOTIFICATION_CHANNEL, {
      name: 'スタッフ向け更新',
      description: 'シフト公開、変更、ヘルプ募集などのお知らせ',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#079663',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted'
      ? existing
      : input.requestPermission
        ? await Notifications.requestPermissionsAsync()
        : existing;
  if (permission.status !== 'granted') {
    throw new Error('通知の利用が許可されていません。端末設定から通知を許可してください。');
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('EAS Project IDが設定されていません。');
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;
  const deviceId = await getDeviceId();
  const { error } = await supabase.from('mobile_push_tokens').upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      device_id: deviceId,
      expo_push_token: token,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' },
  );
  if (error) throw error;
  return token;
}

export async function disablePushNotifications(input: {
  userId: string;
  tenantId: string;
}) {
  if (!supabase) throw new Error('Supabaseが設定されていません。');
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from('mobile_push_tokens')
    .update({ enabled: false, last_seen_at: new Date().toISOString() })
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .eq('device_id', deviceId);
  if (error) throw error;
}

export async function isCurrentDevicePushEnabled(input: {
  userId: string;
  tenantId: string;
}) {
  if (!supabase || Platform.OS === 'web') return false;
  const deviceId = await getDeviceId();
  const { data, error } = await supabase
    .from('mobile_push_tokens')
    .select('enabled')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return false;
    throw error;
  }
  return data?.enabled ?? false;
}
