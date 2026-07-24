import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Pressable,
  Text,
  View,
} from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { PageIntro } from '@/components/ui/page-intro';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/staff/queries';
import type { StaffNotification } from '@/features/staff/types';
import { env } from '@/lib/env';

type FilterKey = 'all' | 'unread' | 'shift' | 'help';
type DateBucket = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

const PAGE_SIZE = 10;
const SHIFT_TYPES = new Set(['shift_published', 'shift_changed']);
const HELP_TYPES = new Set(['help_requested', 'help_application_updated']);
const EMPTY_NOTIFICATIONS: StaffNotification[] = [];

export function NotificationsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigationSequence = useRef(0);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const notices = notifications.data ?? EMPTY_NOTIFICATIONS;
  const unreadCount = notices.filter((notice) => !notice.readAt).length;
  const counts = useMemo(
    () => ({
      all: notices.length,
      unread: unreadCount,
      shift: notices.filter((notice) => SHIFT_TYPES.has(notice.type)).length,
      help: notices.filter((notice) => HELP_TYPES.has(notice.type)).length,
    }),
    [notices, unreadCount],
  );
  const filtered = useMemo(
    () => notices.filter((notice) => matchesFilter(notice, filter)),
    [filter, notices],
  );
  const visibleNotices = filtered.slice(0, visibleCount);

  if (notifications.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="通知を読み込んでいます…" />
      </AppScreen>
    );
  }

  if (notifications.isError) {
    return (
      <AppScreen>
        <ErrorState
          message={notifications.error.message}
          onRetry={() => void notifications.refetch()}
        />
      </AppScreen>
    );
  }

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => Alert.alert('すべて既読にしました'),
      onError: (error) => Alert.alert('既読にできませんでした', error.message),
    });
  };

  const handleMarkRead = (notice: StaffNotification) => {
    if (notice.readAt || markRead.isPending) return;
    markRead.mutate(notice.id, {
      onError: (error) => Alert.alert('既読にできませんでした', error.message),
    });
  };

  const openNotice = (notice: StaffNotification) => {
    handleMarkRead(notice);
    const month = notificationMonth(notice);

    if (SHIFT_TYPES.has(notice.type) || isShiftLink(notice.linkPath)) {
      navigationSequence.current += 1;
      router.navigate({
        pathname: '/(staff)/(shifts)',
        params: month
          ? { month, openedAt: `${notice.id}:${navigationSequence.current}` }
          : {},
      });
      return;
    }

    if (HELP_TYPES.has(notice.type) || notice.linkPath?.includes('/help')) {
      router.navigate('/(staff)/(home)/help');
      return;
    }

    if (notice.type.startsWith('shift_adjustment')) {
      router.navigate('/(staff)/(shifts)');
      return;
    }

    if (notice.linkPath && env.webAppUrl) {
      void WebBrowser.openBrowserAsync(new URL(notice.linkPath, env.webAppUrl).toString(), {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: theme.brand,
      }).catch((error: Error) =>
        Alert.alert('通知先を開けませんでした', error.message),
      );
    }
  };

  let previousBucket: DateBucket | null = null;

  return (
    <AppScreen
      contentContainerStyle={{ paddingTop: appSpacing.sm }}
      refreshing={notifications.isFetching}
      onRefresh={() => void notifications.refetch()}>
      <PageIntro
        eyebrow="Notifications"
        title="通知"
        description="新しい通知から、まとめて確認します。"
      />

      <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
        <HeaderAction
          label="通知設定"
          symbol="slider.horizontal.3"
          active
          onPress={() =>
            router.push('/(staff)/(settings)/settings/notifications')
          }
        />
        <HeaderAction
          label="すべて既読"
          symbol="checkmark.circle"
          loading={markAll.isPending}
          disabled={!unreadCount || markAll.isPending}
          onPress={handleMarkAll}
        />
      </View>

      <View
        style={{
          overflow: 'hidden',
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
        }}>
        <View
          style={{
            minHeight: 88,
            padding: appSpacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: appSpacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.borderSoft,
          }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              selectable
              style={{
                color: theme.warning,
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 1.8,
                textTransform: 'uppercase',
              }}>
              Activity feed
            </Text>
            <Text selectable style={{ color: theme.text, fontSize: 21, fontWeight: '900' }}>
              最近の通知
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="通知を最新に更新"
            disabled={notifications.isFetching}
            onPress={() => void notifications.refetch()}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: appRadii.pill,
              backgroundColor: theme.surfaceMuted,
              opacity: notifications.isFetching ? 0.45 : pressed ? 0.6 : 1,
            })}>
            <Image
              source="sf:arrow.clockwise"
              tintColor={theme.textSecondary}
              style={{ width: 19, height: 19 }}
            />
          </Pressable>
          <CountPill label="未読" value={unreadCount} tone="warning" />
          <CountPill label="合計" value={notices.length} />
        </View>

        {notices.length ? (
          <>
            <View
              style={{
                paddingHorizontal: appSpacing.md,
                paddingVertical: appSpacing.md,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: appSpacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.borderSoft,
                backgroundColor: theme.surface,
              }}>
              {(['all', 'unread', 'shift', 'help'] as const).map((key) => (
                <FilterChip
                  key={key}
                  label={filterLabel(key)}
                  count={counts[key]}
                  selected={filter === key}
                  onPress={() => {
                    setFilter(key);
                    setVisibleCount(PAGE_SIZE);
                  }}
                />
              ))}
            </View>

            {visibleNotices.length ? (
              visibleNotices.map((notice) => {
                const bucket = bucketOf(notice.createdAt);
                const showBucket = bucket !== previousBucket;
                previousBucket = bucket;
                return (
                  <View key={notice.id}>
                    {showBucket ? <DateGroupHeader bucket={bucket} /> : null}
                    <NotificationRow
                      notice={notice}
                      markingRead={
                        markRead.isPending && markRead.variables === notice.id
                      }
                      readDisabled={markRead.isPending}
                      onMarkRead={(event) => {
                        event.stopPropagation();
                        handleMarkRead(notice);
                      }}
                      onPress={() => openNotice(notice)}
                    />
                  </View>
                );
              })
            ) : (
              <View style={{ padding: appSpacing.xxxl }}>
                <EmptyState
                  title="該当する通知はありません"
                  description="別の絞り込み条件を選択してください。"
                />
              </View>
            )}

            {visibleCount < filtered.length ? (
              <View
                style={{
                  padding: appSpacing.md,
                  borderTopWidth: 1,
                  borderTopColor: theme.borderSoft,
                }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setVisibleCount((current) =>
                      Math.min(current + PAGE_SIZE, filtered.length),
                    )
                  }
                  style={({ pressed }) => ({
                    minHeight: 46,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: appRadii.md,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                  })}>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>
                    もっと見る（あと
                    {Math.min(PAGE_SIZE, filtered.length - visibleCount)}件）
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ padding: appSpacing.xxxl }}>
            <EmptyState
              title="通知はまだありません"
              description="シフト公開やヘルプ募集が作成されるとここに表示されます。"
            />
          </View>
        )}
      </View>
    </AppScreen>
  );
}

function NotificationRow({
  notice,
  markingRead,
  readDisabled,
  onMarkRead,
  onPress,
}: {
  notice: StaffNotification;
  markingRead: boolean;
  readDisabled: boolean;
  onMarkRead: (event: GestureResponderEvent) => void;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const presentation = notificationPresentation(notice.type, theme);
  const storeName =
    typeof notice.metadata.store_name === 'string'
      ? notice.metadata.store_name
      : null;
  const hasDestination = Boolean(
    notice.linkPath ||
      SHIFT_TYPES.has(notice.type) ||
      HELP_TYPES.has(notice.type) ||
      notice.type.startsWith('shift_adjustment'),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notice.title}。${notice.body ?? ''}`}
      accessibilityHint={hasDestination ? '関連する画面を開きます' : '既読にします'}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 118,
        paddingHorizontal: appSpacing.lg,
        paddingVertical: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: appSpacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderSoft,
        backgroundColor: !notice.readAt
          ? theme.warningSoft
          : pressed
            ? theme.surfaceMuted
            : theme.surface,
        opacity: pressed ? 0.72 : 1,
      })}>
      <View
        style={{
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: appRadii.pill,
          backgroundColor: presentation.iconBackground,
        }}>
        <Image
          source={`sf:${presentation.symbol}`}
          tintColor={presentation.foreground}
          style={{ width: 23, height: 23 }}
        />
        {!notice.readAt ? (
          <View
            style={{
              position: 'absolute',
              top: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: theme.surface,
              backgroundColor: theme.warning,
            }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
          <Text
            selectable
            numberOfLines={2}
            style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '900' }}>
            {notice.title}
          </Text>
          {hasDestination ? (
            <Text style={{ color: theme.textSecondary, fontSize: 22 }}>›</Text>
          ) : null}
        </View>
        {notice.body ? (
          <Text
            selectable
            numberOfLines={3}
            style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {notice.body}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <MetadataPill
            label={presentation.label}
            background={presentation.iconBackground}
            foreground={presentation.foreground}
          />
          {storeName ? (
            <MetadataPill
              label={storeName}
              background={theme.surfaceMuted}
              foreground={theme.textSecondary}
              symbol="storefront"
            />
          ) : null}
          <Text
            selectable
            style={{
              color: theme.textSecondary,
              fontSize: 10,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}>
            {formatRelativeTime(notice.createdAt)}
          </Text>
          {notice.readAt ? (
            <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '700' }}>
              既読
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${notice.title}を既読にする`}
              accessibilityState={{ disabled: readDisabled, busy: markingRead }}
              disabled={readDisabled}
              onPress={onMarkRead}
              hitSlop={8}
              style={({ pressed }) => ({
                minHeight: 30,
                justifyContent: 'center',
                paddingHorizontal: appSpacing.sm,
                borderRadius: appRadii.pill,
                backgroundColor: theme.surface,
                opacity: readDisabled && !markingRead ? 0.45 : pressed ? 0.6 : 1,
              })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {markingRead ? (
                  <ActivityIndicator color={theme.warning} size="small" />
                ) : null}
                <Text style={{ color: theme.warning, fontSize: 10, fontWeight: '900' }}>
                  {markingRead ? '更新中…' : '既読にする'}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function HeaderAction({
  label,
  symbol,
  active = false,
  loading = false,
  disabled = false,
  onPress,
}: {
  label: string;
  symbol: string;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: appSpacing.sm,
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.pill,
        backgroundColor: active ? theme.hero : theme.borderSoft,
        opacity: disabled ? 0.5 : pressed ? 0.68 : 1,
        boxShadow: active ? '0 8px 18px rgba(2, 6, 23, 0.16)' : undefined,
      })}>
      {loading ? (
        <ActivityIndicator
          color={active ? theme.heroText : theme.textSecondary}
          size="small"
        />
      ) : (
        <Image
          source={`sf:${symbol}`}
          tintColor={active ? theme.heroText : theme.textSecondary}
          style={{ width: 18, height: 18 }}
        />
      )}
      <Text
        style={{
          color: active ? theme.heroText : theme.textSecondary,
          fontSize: 13,
          fontWeight: '900',
        }}>
        {loading ? '更新中…' : label}
      </Text>
    </Pressable>
  );
}

function CountPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warning';
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.pill,
        backgroundColor: tone === 'warning' ? theme.warningSoft : theme.surfaceMuted,
      }}>
      <Text
        style={{
          color: tone === 'warning' ? theme.warning : theme.text,
          fontSize: 11,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}>
        {label} {value}
      </Text>
    </View>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.pill,
        backgroundColor: selected ? theme.hero : theme.surfaceMuted,
        opacity: pressed ? 0.65 : 1,
      })}>
      <Text
        style={{
          color: selected ? theme.heroText : theme.textSecondary,
          fontSize: 12,
          fontWeight: '900',
        }}>
        {label}
      </Text>
      <Text
        style={{
          color: selected ? theme.heroMuted : theme.textSecondary,
          fontSize: 10,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}>
        {count}
      </Text>
    </Pressable>
  );
}

function DateGroupHeader({ bucket }: { bucket: DateBucket }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minHeight: 38,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderSoft,
        backgroundColor: theme.surfaceMuted,
      }}>
      <Text
        style={{
          color: theme.textSecondary,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 1.1,
        }}>
        {dateBucketLabel(bucket)}
      </Text>
    </View>
  );
}

function MetadataPill({
  label,
  background,
  foreground,
  symbol,
}: {
  label: string;
  background: string;
  foreground: string;
  symbol?: string;
}) {
  return (
    <View
      style={{
        minHeight: 24,
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: appSpacing.sm,
        borderRadius: appRadii.pill,
        backgroundColor: background,
      }}>
      {symbol ? (
        <Image
          source={`sf:${symbol}`}
          tintColor={foreground}
          style={{ width: 11, height: 11 }}
        />
      ) : null}
      <Text numberOfLines={1} style={{ color: foreground, fontSize: 10, fontWeight: '900' }}>
        {label}
      </Text>
    </View>
  );
}

function matchesFilter(notice: StaffNotification, filter: FilterKey) {
  if (filter === 'unread') return !notice.readAt;
  if (filter === 'shift') return SHIFT_TYPES.has(notice.type);
  if (filter === 'help') return HELP_TYPES.has(notice.type);
  return true;
}

function filterLabel(filter: FilterKey) {
  if (filter === 'unread') return '未読';
  if (filter === 'shift') return 'シフト';
  if (filter === 'help') return 'ヘルプ';
  return 'すべて';
}

function dateKey(value: string | number) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function bucketOf(createdAt: string): DateBucket {
  const now = Date.now();
  if (dateKey(createdAt) === dateKey(now)) return 'today';
  if (dateKey(createdAt) === dateKey(now - 24 * 60 * 60_000)) return 'yesterday';
  const difference = (now - new Date(createdAt).getTime()) / (24 * 60 * 60_000);
  return difference < 7 ? 'thisWeek' : 'earlier';
}

function dateBucketLabel(bucket: DateBucket) {
  if (bucket === 'today') return '今日';
  if (bucket === 'yesterday') return '昨日';
  if (bucket === 'thisWeek') return '今週';
  return 'それ以前';
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const difference = Math.max(0, Date.now() - date.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (difference < hour) return `${Math.max(1, Math.floor(difference / minute))}分前`;
  if (difference < day) return `${Math.floor(difference / hour)}時間前`;
  if (difference < 7 * day) return `${Math.floor(difference / day)}日前`;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function notificationPresentation(
  type: string,
  theme: ReturnType<typeof useAppTheme>,
) {
  if (type === 'shift_published') {
    return {
      label: 'シフト公開',
      symbol: 'calendar.badge.clock',
      iconBackground: theme.brandSoft,
      foreground: theme.brandStrong,
    };
  }
  if (type === 'shift_changed') {
    return {
      label: 'シフト変更',
      symbol: 'calendar.badge.exclamationmark',
      iconBackground: theme.warningSoft,
      foreground: theme.warning,
    };
  }
  if (type === 'help_requested') {
    return {
      label: 'ヘルプ募集',
      symbol: 'person.2.badge.plus',
      iconBackground: theme.infoSoft,
      foreground: theme.info,
    };
  }
  if (type === 'help_application_updated') {
    return {
      label: '応募更新',
      symbol: 'person.crop.circle.badge.checkmark',
      iconBackground: theme.infoSoft,
      foreground: theme.info,
    };
  }
  return {
    label: '通知',
    symbol: 'sparkles',
    iconBackground: theme.surfaceMuted,
    foreground: theme.textSecondary,
  };
}

function notificationMonth(notice: StaffNotification) {
  const startDate = notice.metadata.start_date;
  if (typeof startDate === 'string' && /^\d{4}-\d{2}/.test(startDate)) {
    return startDate.slice(0, 7);
  }
  const text = `${notice.title} ${notice.body ?? ''}`;
  const match = text.match(/(\d{4})[年/.-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : null;
}

function isShiftLink(linkPath: string | null) {
  return Boolean(
    linkPath === '/app/shifts' ||
      linkPath?.includes('/shift-periods/') ||
      linkPath?.includes('/shifts'),
  );
}
