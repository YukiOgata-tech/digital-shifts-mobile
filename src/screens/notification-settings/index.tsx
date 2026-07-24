import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  disablePushNotifications,
  isCurrentDevicePushEnabled,
  registerPushNotifications,
} from '@/features/notifications/push';
import {
  useNotificationPreferences,
  useStaffIdentity,
  useUpdateNotificationPreferences,
} from '@/features/staff/queries';
import type { NotificationPreferences } from '@/features/staff/types';
import { env } from '@/lib/env';

export function NotificationSettingsScreen() {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const staff = useStaffIdentity();
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const [draftState, setDraftState] = useState<{
    key: string;
    value: NotificationPreferences;
  } | null>(null);
  const [pushDraftState, setPushDraftState] = useState<{
    key: string;
    value: boolean;
  } | null>(null);
  const [savePending, setSavePending] = useState(false);
  const pushStatus = useQuery({
    queryKey: ['push-status', staff.userId, staff.tenantId],
    queryFn: () =>
      isCurrentDevicePushEnabled({
        userId: staff.userId!,
        tenantId: staff.tenantId!,
      }),
    enabled: Boolean(staff.userId && staff.tenantId && env.pushNotificationsEnabled),
  });

  if (staff.isLoading || preferences.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="通知設定を読み込んでいます…" />
      </AppScreen>
    );
  }
  if (staff.error || preferences.isError || !preferences.data) {
    return (
      <AppScreen>
        <ErrorState
          message={staff.error?.message ?? preferences.error?.message}
          onRetry={() => {
            void staff.refresh();
            void preferences.refetch();
          }}
        />
      </AppScreen>
    );
  }

  const draftKey = `${staff.userId}:${staff.tenantId}:${JSON.stringify(preferences.data)}`;
  const draft =
    draftState?.key === draftKey ? draftState.value : preferences.data;
  const pushDraftKey = `${staff.userId}:${staff.tenantId}:${String(pushStatus.data ?? false)}`;
  const pushDraft =
    pushDraftState?.key === pushDraftKey
      ? pushDraftState.value
      : (pushStatus.data ?? false);
  const setValue = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) =>
    setDraftState({
      key: draftKey,
      value: { ...draft, [key]: value },
    });

  const handleSave = async () => {
    if (!staff.userId || !staff.tenantId) return;
    setSavePending(true);
    try {
      await updatePreferences.mutateAsync(draft);
      if (
        env.pushNotificationsEnabled &&
        pushDraft !== (pushStatus.data ?? false)
      ) {
        if (pushDraft) {
          await registerPushNotifications({
            userId: staff.userId,
            tenantId: staff.tenantId,
            requestPermission: true,
          });
        } else {
          await disablePushNotifications({
            userId: staff.userId,
            tenantId: staff.tenantId,
          });
        }
        await queryClient.invalidateQueries({ queryKey: ['push-status'] });
      }
      Alert.alert('通知設定を保存しました');
    } catch (error) {
      Alert.alert(
        '通知設定を保存できませんでした',
        error instanceof Error ? error.message : '通信状態を確認してください。',
      );
    } finally {
      setSavePending(false);
    }
  };

  return (
    <AppScreen
      contentContainerStyle={{ paddingTop: appSpacing.sm }}
      refreshing={preferences.isFetching || pushStatus.isFetching}
      onRefresh={() => {
        void preferences.refetch();
        void pushStatus.refetch();
      }}>
      <TabStackBackButton fallback="/(staff)/(settings)" label="設定" />
      <View style={{ paddingHorizontal: appSpacing.xs, gap: 2 }}>
        <Text style={{ color: theme.warning, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 }}>
          NOTIFICATION SETTINGS
        </Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900' }}>通知設定</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
        <MetricCard
          label="アプリ内通知"
          value={draft.inAppEnabled ? 'ON' : 'OFF'}
          active={draft.inAppEnabled}
        />
        <MetricCard
          label="Push通知"
          value={
            !env.pushNotificationsEnabled
              ? '未設定'
              : pushDraft
                ? 'ON'
                : 'OFF'
          }
          active={Boolean(pushDraft)}
        />
      </View>

      <View style={{ gap: appSpacing.sm }}>
        <PreferenceRow
          title="アプリ内通知"
          description="通知一覧にシフト公開・変更・ヘルプ募集などを表示します。"
          value={draft.inAppEnabled}
          disabled={savePending}
          onChange={(value) => setValue('inAppEnabled', value)}
        />
        <PreferenceRow
          title="Push通知"
          description={
            env.pushNotificationsEnabled
              ? 'この端末へ重要な更新を通知します。保存時にOSの許可を確認します。'
              : 'EAS Project IDとPush credentialsの設定後に利用できます。'
          }
          value={pushDraft}
          disabled={savePending || !env.pushNotificationsEnabled}
          onChange={(value) => setPushDraftState({ key: pushDraftKey, value })}
        />
        <PreferenceRow
          title="メール通知"
          description="重要な通知を登録メールアドレスでも受け取ります。"
          value={draft.emailEnabled}
          disabled={savePending}
          onChange={(value) => setValue('emailEnabled', value)}
        />
      </View>

      <View
        style={{
          padding: appSpacing.lg,
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          backgroundColor: theme.hero,
          boxShadow: '0 14px 28px rgba(2, 6, 23, 0.20)',
        }}>
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: theme.brandBright,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.8,
            }}>
            NOTIFICATION TYPES
          </Text>
          <Text style={{ color: theme.heroText, fontSize: 22, fontWeight: '900' }}>
            通知の種類
          </Text>
          <Text style={{ color: theme.heroMuted, fontSize: 12, lineHeight: 18 }}>
            受け取りたい通知だけをONにできます。アプリ内通知がOFFの場合、通知一覧への新規表示も停止します。
          </Text>
        </View>
        <DarkPreferenceRow
          title="シフト公開通知"
          description="管理者が確定シフトを公開したとき"
          value={draft.shiftPublishedEnabled}
          disabled={savePending}
          onChange={(value) => setValue('shiftPublishedEnabled', value)}
        />
        <DarkPreferenceRow
          title="シフト変更通知"
          description="公開後のシフトが変更・取消されたとき"
          value={draft.shiftChangedEnabled}
          disabled={savePending}
          onChange={(value) => setValue('shiftChangedEnabled', value)}
        />
        <DarkPreferenceRow
          title="ヘルプ募集通知"
          description="所属店舗でヘルプ募集が作成されたとき"
          value={draft.helpRequestedEnabled}
          disabled={savePending}
          onChange={(value) => setValue('helpRequestedEnabled', value)}
        />
      </View>

      <NativeActionButton
        label="通知設定を保存"
        loading={savePending}
        loadingLabel="保存中…"
        tone="dark"
        disabled={savePending}
        onPress={() => void handleSave()}
      />
    </AppScreen>
  );
}

function MetricCard({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 84,
        justifyContent: 'center',
        padding: appSpacing.md,
        gap: 5,
        borderRadius: appRadii.lg,
        backgroundColor: active ? theme.brandSoft : theme.surface,
        borderWidth: 1,
        borderColor: active ? theme.brandBright : theme.borderSoft,
      }}>
      <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}

function PreferenceRow({
  title,
  description,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <SectionCard style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.brandBright }}
        thumbColor={theme.surface}
      />
    </SectionCard>
  );
}

function DarkPreferenceRow({
  title,
  description,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minHeight: 82,
        padding: appSpacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: appSpacing.md,
        borderRadius: appRadii.md,
        backgroundColor: theme.heroRaised,
      }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.heroText, fontSize: 15, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: theme.heroMuted, fontSize: 11, lineHeight: 17 }}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.brandBright }}
        thumbColor={theme.surface}
      />
    </View>
  );
}
