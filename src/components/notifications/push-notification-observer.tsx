import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

function resolveNativePath(data: Record<string, unknown>) {
  const explicitPath = data.nativePath;
  if (explicitPath === '/notifications') return '/(staff)/(notifications)';
  if (explicitPath === '/profile') return '/(staff)/(settings)';
  if (typeof explicitPath === 'string' && explicitPath.startsWith('/')) return explicitPath;

  const webPath = data.linkPath ?? data.link_path;
  if (typeof webPath !== 'string') return '/(staff)/(notifications)';
  if (webPath.includes('/help')) return '/(staff)/(home)/help';
  if (webPath.includes('/attendance')) return '/(staff)/(attendance)';
  if (webPath.includes('/shift-periods') || webPath.includes('/shifts')) {
    return '/(staff)/(shifts)';
  }
  return '/(staff)/(notifications)';
}

export function PushNotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    const navigate = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data ?? {};
      const path = resolveNativePath(data);
      if (path === '/(staff)/(shifts)') {
        const month = resolveNotificationMonth(data);
        router.navigate({
          pathname: '/(staff)/(shifts)',
          params: month
            ? {
                month,
                openedAt: response.notification.request.identifier,
              }
            : {},
        });
        return;
      }
      router.navigate(path as never);
    };

    void Notifications.getLastNotificationResponseAsync().then(navigate);
    const subscription = Notifications.addNotificationResponseReceivedListener(navigate);
    return () => subscription.remove();
  }, [router]);

  return null;
}

function resolveNotificationMonth(data: Record<string, unknown>) {
  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {};
  const startDate = data.start_date ?? data.startDate ?? metadata.start_date;
  if (typeof startDate === 'string' && /^\d{4}-\d{2}/.test(startDate)) {
    return startDate.slice(0, 7);
  }
  const body = typeof data.body === 'string' ? data.body : '';
  const match = body.match(/(\d{4})[年/.-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : null;
}
