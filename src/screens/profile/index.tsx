import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState, LoadingState } from '@/components/ui/data-state';
import { ListRow } from '@/components/ui/list-row';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { PageIntro } from '@/components/ui/page-intro';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
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
  useUpdateStaffProfile,
} from '@/features/staff/queries';
import type { NotificationPreferences } from '@/features/staff/types';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const staff = useStaffIdentity();
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const updateProfile = useUpdateStaffProfile();
  const [profileDraft, setProfileDraft] = useState<{
    profileId: string;
    displayName: string;
    phoneNumber: string;
  } | null>(null);
  const displayName =
    profileDraft && profileDraft.profileId === staff.profile?.id
      ? profileDraft.displayName
      : (staff.profile?.displayName ?? '');
  const phoneNumber =
    profileDraft && profileDraft.profileId === staff.profile?.id
      ? profileDraft.phoneNumber
      : (staff.profile?.phoneNumber ?? '');
  const pushStatus = useQuery({
    queryKey: ['push-status', staff.userId, staff.tenantId],
    queryFn: () =>
      isCurrentDevicePushEnabled({
        userId: staff.userId!,
        tenantId: staff.tenantId!,
      }),
    enabled: Boolean(staff.userId && staff.tenantId && env.pushNotificationsEnabled),
  });
  const pushMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!staff.userId || !staff.tenantId) throw new Error('所属情報を確認できません。');
      if (enabled) {
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
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-status'] }),
  });

  const openWebPath = async (path: string, label: string) => {
    if (!env.webAppUrl) {
      Alert.alert(`${label}を開けません`, 'WEBアプリURLが設定されていません。');
      return;
    }
    const url = new URL(path, env.webAppUrl).toString();
    if (!(await Linking.canOpenURL(url))) {
      Alert.alert(`${label}を開けません`, url);
      return;
    }
    await Linking.openURL(url);
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('ログアウトできませんでした', error.message);
        return;
      }
    }
    router.replace('/(auth)/sign-in');
  };

  const update = (patch: Partial<NotificationPreferences>) => {
    if (!preferences.data) return;
    updatePreferences.mutate(
      { ...preferences.data, ...patch },
      {
        onError: (error) => Alert.alert('通知設定を保存できませんでした', error.message),
      },
    );
  };

  if (staff.isLoading || preferences.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="設定を読み込んでいます…" />
      </AppScreen>
    );
  }
  if (staff.error || preferences.isError) {
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

  return (
    <AppScreen
      refreshing={preferences.isFetching || pushStatus.isFetching}
      onRefresh={() => {
        void preferences.refetch();
        void pushStatus.refetch();
      }}>
      <PageIntro
        eyebrow="Settings"
        title="設定"
        description="アカウント、所属店舗、通知とアプリの利用設定を管理します。"
      />

      <View
        style={{
          padding: appSpacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          backgroundColor: theme.hero,
          boxShadow: '0 14px 32px rgba(2, 6, 23, 0.22)',
        }}>
        <View
          style={{
            width: 54,
            height: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: appRadii.pill,
            backgroundColor: theme.brandBright,
          }}>
          <Text style={{ color: theme.hero, fontSize: 22, fontWeight: '900' }}>
            {(staff.profile?.displayName ?? staff.profile?.email ?? 'ス').slice(0, 1)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: theme.heroText, fontSize: 18, fontWeight: '900' }}>
            {staff.profile?.displayName ?? 'スタッフ'}
          </Text>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: theme.heroMuted, fontSize: 12 }}>
            {staff.profile?.email}
          </Text>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: theme.brandBright, fontSize: 11, fontWeight: '800' }}>
            {staff.activeTenant?.role ?? 'staff'} · {staff.activeTenant?.name}
          </Text>
        </View>
        <StatusPill
          label={
            staff.activeTenant?.role === 'owner'
              ? 'オーナー'
              : staff.activeTenant?.role === 'manager'
                ? '管理者'
                : 'スタッフ'
          }
          tone="brand"
        />
      </View>

      <SettingsGroupHeading eyebrow="Account" title="プロフィール" />
      <SectionCard>
        <View style={{ gap: appSpacing.sm }}>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            表示名
          </Text>
          <TextInput
            value={displayName}
            onChangeText={(value) =>
              setProfileDraft({
                profileId: staff.profile!.id,
                displayName: value,
                phoneNumber,
              })
            }
            maxLength={100}
            placeholder="表示名"
            placeholderTextColor={theme.textSecondary}
            style={{
              minHeight: 48,
              paddingHorizontal: appSpacing.md,
              borderRadius: appRadii.sm,
              backgroundColor: theme.surfaceMuted,
              color: theme.text,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ gap: appSpacing.sm }}>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            電話番号
          </Text>
          <TextInput
            value={phoneNumber}
            onChangeText={(value) =>
              setProfileDraft({
                profileId: staff.profile!.id,
                displayName,
                phoneNumber: value,
              })
            }
            maxLength={30}
            keyboardType="phone-pad"
            placeholder="電話番号（任意）"
            placeholderTextColor={theme.textSecondary}
            style={{
              minHeight: 48,
              paddingHorizontal: appSpacing.md,
              borderRadius: appRadii.sm,
              backgroundColor: theme.surfaceMuted,
              color: theme.text,
              fontSize: 16,
            }}
          />
        </View>
        <NativeActionButton
          label={updateProfile.isPending ? '保存中…' : 'プロフィールを保存'}
          disabled={updateProfile.isPending || !displayName.trim()}
          onPress={() =>
            updateProfile.mutate(
              { displayName, phoneNumber: phoneNumber || null },
              {
                onSuccess: () => {
                  setProfileDraft(null);
                  Alert.alert('保存しました');
                },
                onError: (error) => Alert.alert('プロフィールを保存できませんでした', error.message),
              },
            )
          }
        />
      </SectionCard>

      {staff.tenants.length > 1 ? (
        <View style={{ gap: appSpacing.sm }}>
          <SettingsGroupHeading eyebrow="Organization" title="利用する組織" />
          {staff.tenants.map((tenant) => (
            <ListRow
              key={tenant.id}
              title={tenant.name}
              subtitle={tenant.role === 'staff' ? 'スタッフ' : '管理者'}
              trailing={
                tenant.id === staff.activeTenant?.id ? (
                  <StatusPill label="選択中" tone="brand" />
                ) : undefined
              }
              onPress={() => staff.setActiveTenantId(tenant.id)}
            />
          ))}
        </View>
      ) : null}

      {staff.stores.length > 1 ? (
        <View style={{ gap: appSpacing.sm }}>
          <SettingsGroupHeading eyebrow="Stores" title="利用する店舗" />
          {staff.stores.map((store) => (
            <ListRow
              key={store.id}
              title={store.name}
              subtitle={store.address ?? store.code ?? undefined}
              trailing={
                store.id === staff.activeStore?.id ? (
                  <StatusPill label="選択中" tone="brand" />
                ) : undefined
              }
              onPress={() => staff.setActiveStoreId(store.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: appSpacing.sm }}>
        <SettingsGroupHeading eyebrow="Notifications" title="通知設定" />
        <ListRow
          title="アプリ内通知"
          subtitle="シフト公開、申請結果などを通知一覧に表示"
          trailing={
            <Switch
              value={preferences.data?.inAppEnabled ?? true}
              disabled={updatePreferences.isPending}
              onValueChange={(value) => update({ inAppEnabled: value })}
            />
          }
        />
        <ListRow
          title="Push通知"
          subtitle={
            env.pushNotificationsEnabled
              ? 'この端末へ重要な更新をお知らせ'
              : 'EAS Project ID設定後に利用できます'
          }
          trailing={
            <Switch
              value={pushStatus.data ?? false}
              disabled={!env.pushNotificationsEnabled || pushMutation.isPending}
              onValueChange={(value) =>
                pushMutation.mutate(value, {
                  onError: (error) => Alert.alert('Push通知を変更できませんでした', error.message),
                })
              }
            />
          }
        />
        <ListRow
          title="シフト公開"
          subtitle="新しい確定シフトが公開された時"
          trailing={
            <Switch
              value={preferences.data?.shiftPublishedEnabled ?? true}
              disabled={updatePreferences.isPending}
              onValueChange={(value) => update({ shiftPublishedEnabled: value })}
            />
          }
        />
        <ListRow
          title="シフト変更"
          subtitle="確定シフトが変更された時"
          trailing={
            <Switch
              value={preferences.data?.shiftChangedEnabled ?? true}
              disabled={updatePreferences.isPending}
              onValueChange={(value) => update({ shiftChangedEnabled: value })}
            />
          }
        />
        <ListRow
          title="ヘルプ募集"
          subtitle="所属店舗で応援募集が作成された時"
          trailing={
            <Switch
              value={preferences.data?.helpRequestedEnabled ?? true}
              disabled={updatePreferences.isPending}
              onValueChange={(value) => update({ helpRequestedEnabled: value })}
            />
          }
        />
        <ListRow
          title="メール通知"
          subtitle="契約プラン判定を含むため、現在はWEB版の設定を反映"
          trailing={
            <StatusPill
              label={preferences.data?.emailEnabled ? '有効' : '無効'}
              tone={preferences.data?.emailEnabled ? 'brand' : 'neutral'}
            />
          }
        />
      </View>

      <View style={{ gap: appSpacing.sm }}>
        <SettingsGroupHeading eyebrow="Support & legal" title="サポート" />
        <ListRow title="ヘルプセンター" onPress={() => void openWebPath('/help', 'ヘルプセンター')} />
        <ListRow title="利用規約" onPress={() => void openWebPath('/terms', '利用規約')} />
        <ListRow
          title="プライバシーポリシー"
          onPress={() => void openWebPath('/privacy', 'プライバシーポリシー')}
        />
      </View>

      <NativeActionButton
        label="ログアウト"
        variant="outlined"
        tone="danger"
        onPress={() => void signOut()}
      />
    </AppScreen>
  );
}

function SettingsGroupHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const theme = useAppTheme();

  return (
    <View style={{ gap: 2, paddingHorizontal: appSpacing.xs }}>
      <Text
        selectable
        style={{
          color: theme.brandStrong,
          fontSize: 9,
          fontWeight: '900',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}>
        {eyebrow}
      </Text>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
        {title}
      </Text>
    </View>
  );
}
