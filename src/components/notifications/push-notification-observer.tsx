import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

function resolveNativePath(data: Record<string, unknown>) {
  const explicitPath = data.nativePath;
  if (typeof explicitPath === 'string' && explicitPath.startsWith('/')) return explicitPath;

  const webPath = data.linkPath ?? data.link_path;
  if (typeof webPath !== 'string') return '/notifications';
  if (webPath.includes('/help')) return '/help';
  if (webPath.includes('/attendance')) return '/(staff)/(attendance)';
  if (webPath.includes('/shift-periods') || webPath.includes('/shifts')) {
    return '/(staff)/(shifts)';
  }
  return '/notifications';
}

export function PushNotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    const navigate = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const path = resolveNativePath(response.notification.request.content.data ?? {});
      router.push(path as never);
    };

    void Notifications.getLastNotificationResponseAsync().then(navigate);
    const subscription = Notifications.addNotificationResponseReceivedListener(navigate);
    return () => subscription.remove();
  }, [router]);

  return null;
}
