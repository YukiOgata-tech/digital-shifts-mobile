import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { env, isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export function SignInScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signIn = async () => {
    if (!supabase) {
      setErrorMessage('Supabaseの公開URLとPublishable Keyを設定してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace('/(staff)/(home)');
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          minHeight: Math.max(0, height - insets.top - insets.bottom),
          justifyContent: 'center',
          paddingHorizontal: appSpacing.xl,
          paddingTop: appSpacing.xxl,
          paddingBottom: appSpacing.xxl,
          gap: appSpacing.xxl,
        }}>
        <View style={{ gap: appSpacing.xl }}>
          <View
            style={{
              alignSelf: 'flex-start',
              width: 52,
              height: 52,
              borderCurve: 'continuous',
            }}>
            <Image
              source={require('@/assets/images/brand/dmise-logo.png')}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </View>
          <View style={{ gap: appSpacing.sm }}>
            <Text
              selectable
              style={{
                color: theme.brandStrong,
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 2.4,
                textTransform: 'uppercase',
              }}>
              Welcome back
            </Text>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: 32,
                fontWeight: '900',
                letterSpacing: -1,
              }}>
              ログイン / SIGN IN
            </Text>
            <Text
              selectable
              style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 22 }}>
              既存の{env.appName}アカウントでログインし、シフト・打刻・通知を確認します。
            </Text>
          </View>
        </View>

        <SectionCard
          style={{
            padding: appSpacing.xl,
            gap: appSpacing.xl,
            borderColor: 'rgba(255,255,255,0.8)',
            borderRadius: appRadii.xl,
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
          }}>
          <View style={{ gap: appSpacing.sm }}>
            <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              メールアドレス
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              placeholder="staff@example.com"
              placeholderTextColor={theme.textSecondary}
              style={{
                minHeight: 50,
                paddingHorizontal: appSpacing.lg,
                color: theme.text,
                backgroundColor: theme.surface,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: theme.borderSoft,
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ gap: appSpacing.sm }}>
            <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              パスワード
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void signIn()}
              placeholder="パスワード"
              placeholderTextColor={theme.textSecondary}
              style={{
                minHeight: 50,
                paddingHorizontal: appSpacing.lg,
                color: theme.text,
                backgroundColor: theme.surface,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: theme.borderSoft,
                fontSize: 16,
              }}
            />
          </View>

          {errorMessage ? (
            <Text selectable style={{ color: theme.danger, fontSize: 14, lineHeight: 20 }}>
              {errorMessage}
            </Text>
          ) : null}

          <NativeActionButton
            label="ログイン"
            loading={isSubmitting}
            loadingLabel="ログイン中…"
            tone="dark"
            disabled={
              isSubmitting ||
              !isSupabaseConfigured ||
              email.trim().length === 0 ||
              password.length === 0
            }
            haptic="success"
            onPress={() => void signIn()}
          />
        </SectionCard>

        {!isSupabaseConfigured ? (
          <Text
            selectable
            style={{
              color: theme.textSecondary,
              fontSize: 13,
              lineHeight: 19,
              textAlign: 'center',
            }}>
            `.env.example`を参考にローカル環境変数を設定するとログインできます。
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
