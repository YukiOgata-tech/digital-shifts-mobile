import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { AppScreen } from '@/components/ui/app-screen';
import { ErrorState, LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { useSession } from '@/features/auth/session-provider';
import { useStaffIdentity, useUpdateStaffProfile } from '@/features/staff/queries';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

type EmailStep = 'input' | 'otp';

export function ProfileScreen() {
  const theme = useAppTheme();
  const { session } = useSession();
  const staff = useStaffIdentity();
  const updateProfile = useUpdateStaffProfile();
  const [profileDraft, setProfileDraft] = useState<{
    profileId: string;
    displayName: string;
    phoneNumber: string;
  } | null>(null);
  const [emailStep, setEmailStep] = useState<EmailStep>('input');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [authAction, setAuthAction] = useState<
    'reauthentication' | 'email-change' | 'password-reset' | null
  >(null);
  const authPending = authAction !== null;

  if (staff.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="アカウントを読み込んでいます…" />
      </AppScreen>
    );
  }
  if (staff.error || !staff.profile || !session?.user) {
    return (
      <AppScreen>
        <ErrorState
          message={staff.error?.message ?? 'アカウント情報を確認できませんでした。'}
          onRetry={() => void staff.refresh()}
        />
      </AppScreen>
    );
  }

  const user = session.user;
  const currentEmail = user.email ?? staff.profile.email ?? '';
  const displayName =
    profileDraft?.profileId === staff.profile.id
      ? profileDraft.displayName
      : staff.profile.displayName;
  const phoneNumber =
    profileDraft?.profileId === staff.profile.id
      ? profileDraft.phoneNumber
      : (staff.profile.phoneNumber ?? '');

  const sendReauthenticationCode = async () => {
    if (!supabase) throw new Error('Supabaseが設定されていません。');
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('新しいメールアドレスを正しく入力してください。');
    }
    if (normalizedEmail === currentEmail.toLowerCase()) {
      throw new Error('現在と異なるメールアドレスを入力してください。');
    }
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
    setNewEmail(normalizedEmail);
    setEmailStep('otp');
    setOtp('');
  };

  const requestEmailChange = async () => {
    if (!supabase) throw new Error('Supabaseが設定されていません。');
    if (!/^\d{6}$/.test(otp)) {
      throw new Error('確認コードは6桁で入力してください。');
    }
    if (!env.webAppUrl) {
      throw new Error('EXPO_PUBLIC_WEB_APP_URLが未設定です。');
    }
    const emailRedirectTo = new URL(
      '/auth/callback?next=/app/settings/account',
      env.webAppUrl,
    ).toString();
    const { error } = await supabase.auth.updateUser(
      { email: newEmail, nonce: otp },
      { emailRedirectTo },
    );
    if (error) throw error;
    setEmailStep('input');
    setNewEmail('');
    setOtp('');
    Alert.alert(
      '確認メールを送信しました',
      `新しいメールアドレス（${newEmail}）に届くリンクを開いて変更を完了してください。`,
    );
  };

  const sendPasswordReset = async () => {
    if (!supabase) throw new Error('Supabaseが設定されていません。');
    if (!currentEmail) throw new Error('メールアドレスを確認できません。');
    if (!env.webAppUrl) throw new Error('EXPO_PUBLIC_WEB_APP_URLが未設定です。');
    const redirectTo = new URL(
      '/auth/callback?next=/auth/reset-password',
      env.webAppUrl,
    ).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
      redirectTo,
    });
    if (error) throw error;
    Alert.alert(
      'リセットメールを送信しました',
      `${currentEmail}に届くリンクから新しいパスワードを設定してください。`,
    );
  };

  const runAuthAction = async (
    action: () => Promise<void>,
    title: string,
    key: NonNullable<typeof authAction>,
  ) => {
    setAuthAction(key);
    try {
      await action();
    } catch (error) {
      Alert.alert(title, error instanceof Error ? error.message : 'もう一度お試しください。');
    } finally {
      setAuthAction(null);
    }
  };

  return (
    <AppScreen contentContainerStyle={{ paddingTop: appSpacing.sm }}>
      <TabStackBackButton fallback="/(staff)/(settings)" label="設定" />
      <View style={{ paddingHorizontal: appSpacing.xs, gap: 2 }}>
        <Text style={{ color: theme.brandStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 }}>
          ACCOUNT
        </Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900' }}>アカウント</Text>
      </View>

      <View
        style={{
          padding: appSpacing.lg,
          gap: appSpacing.lg,
          borderRadius: appRadii.lg,
          borderCurve: 'continuous',
          backgroundColor: theme.hero,
          boxShadow: '0 16px 32px rgba(2, 6, 23, 0.22)',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.md }}>
          <View
            style={{
              width: 58,
              height: 58,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: appRadii.md,
              backgroundColor: theme.brandBright,
            }}>
            <Text style={{ color: theme.hero, fontSize: 25, fontWeight: '900' }}>
              {(displayName || currentEmail || 'ス').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={1} style={{ color: theme.heroText, fontSize: 20, fontWeight: '900' }}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.heroMuted, fontSize: 12 }}>
              {currentEmail}
            </Text>
            <Text style={{ color: theme.brandBright, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
              {staff.activeTenant?.role ?? 'staff'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: appSpacing.sm }}>
          <AccountMetric
            label="メール確認"
            value={user.email_confirmed_at ? '確認済み' : '未確認'}
            accent={Boolean(user.email_confirmed_at)}
          />
          <AccountMetric
            label="最終ログイン"
            value={
              user.last_sign_in_at
                ? new Intl.DateTimeFormat('ja-JP', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  }).format(new Date(user.last_sign_in_at))
                : '不明'
            }
          />
          <AccountMetric label="電話番号" value={staff.profile.phoneNumber || '未設定'} />
          <AccountMetric label="タイムゾーン" value={staff.profile.timezone || 'Asia/Tokyo'} />
        </View>
      </View>

      <SectionCard>
        <SectionTitle title="プロフィール編集" />
        <FieldLabel label="表示名" required />
        <SettingsInput
          value={displayName}
          maxLength={50}
          placeholder="表示名"
          onChangeText={(value) =>
            setProfileDraft({
              profileId: staff.profile!.id,
              displayName: value,
              phoneNumber,
            })
          }
        />
        <FieldLabel label="電話番号" />
        <SettingsInput
          value={phoneNumber}
          maxLength={20}
          keyboardType="phone-pad"
          placeholder="090-0000-0000"
          onChangeText={(value) =>
            setProfileDraft({
              profileId: staff.profile!.id,
              displayName,
              phoneNumber: value,
            })
          }
        />
        <NativeActionButton
          label="保存する"
          loading={updateProfile.isPending}
          loadingLabel="保存中…"
          tone="dark"
          disabled={updateProfile.isPending || !displayName.trim()}
          onPress={() =>
            updateProfile.mutate(
              { displayName, phoneNumber: phoneNumber || null },
              {
                onSuccess: () => {
                  setProfileDraft(null);
                  Alert.alert('プロフィールを保存しました');
                },
                onError: (error) =>
                  Alert.alert('プロフィールを保存できませんでした', error.message),
              },
            )
          }
        />
      </SectionCard>

      <SectionCard>
        <SectionTitle
          title="メールアドレス変更"
          description="本人確認後、新しいアドレスへ確認メールを送信します。"
        />
        <FieldLabel label="現在のメールアドレス" />
        <ReadOnlyValue value={currentEmail} />
        {emailStep === 'input' ? (
          <>
            <FieldLabel label="新しいメールアドレス" required />
            <SettingsInput
              value={newEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="new@example.com"
              onChangeText={setNewEmail}
            />
            <NativeActionButton
              label="確認コードを送信"
              loading={authAction === 'reauthentication'}
              loadingLabel="送信中…"
              tone="dark"
              disabled={authPending || !newEmail.trim()}
              onPress={() =>
                void runAuthAction(
                  sendReauthenticationCode,
                  '確認コードを送信できませんでした',
                  'reauthentication',
                )
              }
            />
          </>
        ) : (
          <>
            <View
              style={{
                padding: appSpacing.md,
                borderRadius: appRadii.md,
                backgroundColor: theme.infoSoft,
              }}>
              <Text style={{ color: theme.info, fontSize: 12, fontWeight: '700', lineHeight: 18 }}>
                {currentEmail} に届いた6桁の確認コードを入力してください。
              </Text>
            </View>
            <FieldLabel label="確認コード" required />
            <SettingsInput
              value={otp}
              maxLength={6}
              keyboardType="number-pad"
              placeholder="000000"
              onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
            />
            <Text style={{ color: theme.danger, fontSize: 12, fontWeight: '700', lineHeight: 18 }}>
              {currentEmail} → {newEmail}
            </Text>
            <NativeActionButton
              label="メールアドレスを変更"
              loading={authAction === 'email-change'}
              loadingLabel="変更中…"
              tone="danger"
              disabled={authPending || otp.length !== 6}
              onPress={() =>
                void runAuthAction(
                  requestEmailChange,
                  'メールアドレスを変更できませんでした',
                  'email-change',
                )
              }
            />
            <NativeActionButton
              label="キャンセル"
              variant="text"
              disabled={authPending}
              onPress={() => {
                setEmailStep('input');
                setOtp('');
              }}
            />
          </>
        )}
      </SectionCard>

      <SectionCard>
        <SectionTitle
          title="パスワード変更"
          description="パスワード再設定リンクをメールで送信します。リンク先の安全な画面で新しいパスワードを設定できます。"
        />
        <NativeActionButton
          label="リセットメールを送信"
          loading={authAction === 'password-reset'}
          loadingLabel="送信中…"
          tone="dark"
          disabled={authPending || !currentEmail}
          onPress={() =>
            Alert.alert(
              'パスワード再設定メールを送信しますか？',
              `送信先: ${currentEmail}`,
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '送信',
                  onPress: () =>
                    void runAuthAction(
                      sendPasswordReset,
                      'メールを送信できませんでした',
                      'password-reset',
                    ),
                },
              ],
            )
          }
        />
      </SectionCard>
    </AppScreen>
  );
}

function AccountMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        width: '48.5%',
        minHeight: 74,
        justifyContent: 'center',
        padding: appSpacing.md,
        gap: 5,
        borderRadius: appRadii.md,
        backgroundColor: theme.heroRaised,
      }}>
      <Text style={{ color: theme.heroMuted, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: accent ? theme.brandBright : theme.heroText, fontSize: 14, fontWeight: '900' }}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
      {description ? (
        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>{description}</Text>
      ) : null}
    </View>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  const theme = useAppTheme();
  return (
    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '800' }}>
      {label}
      {required ? <Text style={{ color: theme.danger }}> *</Text> : null}
    </Text>
  );
}

function SettingsInput(props: React.ComponentProps<typeof TextInput>) {
  const theme = useAppTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.textSecondary}
      style={[
        {
          minHeight: 48,
          paddingHorizontal: appSpacing.md,
          borderRadius: appRadii.sm,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          color: theme.text,
          fontSize: 15,
          fontWeight: '700',
        },
        props.style,
      ]}
    />
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.sm,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surfaceMuted,
      }}>
      <Text numberOfLines={1} selectable style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}
