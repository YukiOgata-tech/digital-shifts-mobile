import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState, LoadingState } from '@/components/ui/data-state';
import { ListRow } from '@/components/ui/list-row';
import { PageIntro } from '@/components/ui/page-intro';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { useStaffIdentity } from '@/features/staff/queries';
import { env } from '@/lib/env';

type SettingsRoute = {
  eyebrow: string;
  title: string;
  description: string;
  symbol: SymbolViewProps['name'];
  href: Href;
};

const settingsRoutes: SettingsRoute[] = [
  {
    eyebrow: 'Account',
    title: 'アカウント情報',
    description: 'プロフィール、メールアドレス、パスワード',
    symbol: 'person.crop.circle.fill',
    href: '/(staff)/(settings)/settings/account',
  },
  {
    eyebrow: 'Notifications',
    title: '通知設定',
    description: 'アプリ内・Push・メール通知と通知の種類',
    symbol: 'bell.fill',
    href: '/(staff)/(settings)/settings/notifications',
  },
  {
    eyebrow: 'Preferences',
    title: '操作・データ設定',
    description: '表示言語、曜日別の希望シフト初期値、端末データ',
    symbol: 'gearshape.2.fill',
    href: '/(staff)/(settings)/settings/preferences',
  },
];

export function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();

  const openWebPath = async (path: string, label: string) => {
    if (!env.webAppUrl) {
      Alert.alert(`${label}を開けません`, '.envにEXPO_PUBLIC_WEB_APP_URLを設定してください。');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(new URL(path, env.webAppUrl).toString(), {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: theme.brand,
      });
    } catch (error) {
      Alert.alert(
        `${label}を開けません`,
        error instanceof Error ? error.message : '通信状態を確認してください。',
      );
    }
  };

  if (staff.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="設定を読み込んでいます…" />
      </AppScreen>
    );
  }
  if (staff.error) {
    return (
      <AppScreen>
        <ErrorState message={staff.error.message} onRetry={() => void staff.refresh()} />
      </AppScreen>
    );
  }

  const profileLabel = staff.profile?.displayName || staff.profile?.email || 'スタッフ';
  const roleLabel =
    staff.activeTenant?.role === 'owner'
      ? 'owner'
      : staff.activeTenant?.role === 'manager'
        ? 'manager'
        : 'staff';

  return (
    <AppScreen
      refreshing={false}
      onRefresh={() => void staff.refresh()}
      contentContainerStyle={{ paddingTop: appSpacing.sm }}>
      <PageIntro eyebrow="Settings" title="設定" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="アカウント情報を編集"
        onPress={() => router.push('/(staff)/(settings)/settings/account')}
        style={({ pressed }) => ({
          padding: appSpacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: appSpacing.md,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          backgroundColor: theme.hero,
          boxShadow: '0 16px 30px rgba(2, 6, 23, 0.20)',
          opacity: pressed ? 0.82 : 1,
        })}>
        <View
          style={{
            width: 52,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: appRadii.md,
            backgroundColor: theme.brandBright,
          }}>
          <Text style={{ color: theme.hero, fontSize: 22, fontWeight: '900' }}>
            {profileLabel.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={{ color: theme.heroText, fontSize: 18, fontWeight: '900' }}>
            {profileLabel}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.heroMuted, fontSize: 12 }}>
            {staff.profile?.email}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.brandBright, fontSize: 11, fontWeight: '800' }}>
            {roleLabel} · {staff.activeTenant?.name}
          </Text>
        </View>
        <View
          style={{
            minHeight: 40,
            justifyContent: 'center',
            paddingHorizontal: appSpacing.md,
            borderRadius: appRadii.sm,
            backgroundColor: theme.heroRaised,
          }}>
          <Text style={{ color: theme.heroText, fontSize: 12, fontWeight: '900' }}>編集</Text>
        </View>
      </Pressable>

      <View style={{ gap: appSpacing.sm }}>
        {settingsRoutes.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}を開く`}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => ({
              minHeight: 76,
              padding: appSpacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: appSpacing.md,
              borderRadius: appRadii.lg,
              borderCurve: 'continuous',
              backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
              borderWidth: 1,
              borderColor: theme.borderSoft,
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.10)',
            })}>
            <View
              style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: appRadii.md,
                backgroundColor: theme.surfaceMuted,
              }}>
              <SymbolView
                name={item.symbol}
                tintColor={theme.brandStrong}
                style={{ width: 25, height: 25 }}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  color: theme.brandStrong,
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}>
                {item.eyebrow}
              </Text>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{item.title}</Text>
              <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11 }}>
                {item.description}
              </Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 24 }}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: appSpacing.sm, paddingTop: appSpacing.md }}>
        <Text
          style={{
            color: theme.textSecondary,
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.8,
            textTransform: 'uppercase',
          }}>
          Support & Legal
        </Text>
        <ListRow
          title="ヘルプ"
          subtitle="操作方法とよくある質問"
          onPress={() => void openWebPath('/app/help', 'ヘルプ')}
        />
        <ListRow
          title="利用規約"
          subtitle="サービスの利用条件"
          onPress={() => void openWebPath('/terms', '利用規約')}
        />
        <ListRow
          title="プライバシーポリシー"
          subtitle="個人情報とデータの取り扱い"
          onPress={() => void openWebPath('/privacy', 'プライバシーポリシー')}
        />
        <ListRow
          title="特定商取引法に基づく表記"
          subtitle="サービス提供者に関する表示"
          onPress={() =>
            void openWebPath('/commercial-transactions', '特定商取引法に基づく表記')
          }
        />
      </View>
    </AppScreen>
  );
}
