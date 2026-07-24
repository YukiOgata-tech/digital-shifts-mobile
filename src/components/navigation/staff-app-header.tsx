import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { useStaffIdentity } from '@/features/staff/queries';
import { supabase } from '@/lib/supabase';

export function StaffAppHeader() {
  const router = useRouter();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const staff = useStaffIdentity();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const compact = width < 390;
  const tenantName = staff.activeTenant?.name ?? '所属組織を確認中';
  const email = staff.profile?.email ?? 'アカウントを確認中';

  const openAttendance = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    router.push('/(staff)/(attendance)');
  };

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const { error } = supabase
      ? await supabase.auth.signOut()
      : { error: new Error('Supabaseが設定されていません。') };
    setIsSigningOut(false);
    if (error) {
      Alert.alert('ログアウトできませんでした', error.message);
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.replace('/(auth)/sign-in');
  };

  const confirmSignOut = () => {
    Alert.alert('ログアウトしますか？', 'この端末のDミセからログアウトします。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderSoft,
      }}>
      <View
        style={{
          minHeight: compact ? 52 : 56,
          paddingHorizontal: appSpacing.md,
          paddingTop: 2,
          paddingBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? appSpacing.sm : appSpacing.md,
        }}>
        <Image
          source={require('@/assets/images/brand/dmise-logo.png')}
          contentFit="contain"
          style={{
            width: compact ? 44 : 48,
            height: compact ? 44 : 48,
            flexShrink: 0,
          }}
        />

        <View style={{ minWidth: 0, flex: 1, gap: 1 }}>
          <Text
            selectable
            numberOfLines={1}
            style={{
              color: theme.brandStrong,
              fontSize: compact ? 10 : 11,
              fontWeight: '900',
              letterSpacing: 1.4,
            }}>
            Dミセ
          </Text>
          <Text
            selectable
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: theme.text,
              fontSize: compact ? 16 : 18,
              fontWeight: '900',
              letterSpacing: -0.3,
            }}>
            {tenantName}
          </Text>
          <Text
            selectable
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ color: theme.textSecondary, fontSize: compact ? 10 : 12 }}>
            {email} - ログイン中
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: compact ? 6 : appSpacing.sm }}>
          <HeaderAction
            accessibilityLabel="打刻画面を開く"
            color={theme.brand}
            icon="clock"
            fallbackIcon="◷"
            compact={compact}
            onPress={openAttendance}
          />
          <HeaderAction
            accessibilityLabel="ログアウト"
            color="#F50046"
            icon="rectangle.portrait.and.arrow.right"
            fallbackIcon="↪"
            compact={compact}
            loading={isSigningOut}
            disabled={isSigningOut}
            onPress={confirmSignOut}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function HeaderAction({
  accessibilityLabel,
  color,
  icon,
  fallbackIcon,
  compact,
  loading = false,
  disabled = false,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  icon: 'clock' | 'rectangle.portrait.and.arrow.right';
  fallbackIcon: string;
  compact: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? 'ログアウト中' : accessibilityLabel}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        width: compact ? 42 : 46,
        height: compact ? 42 : 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: appRadii.lg,
        borderCurve: 'continuous',
        backgroundColor: color,
        opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        boxShadow: `0 8px 18px ${color}33`,
      })}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : process.env.EXPO_OS === 'ios' ? (
        <SymbolView
          name={icon}
          tintColor="#FFFFFF"
          weight="medium"
          resizeMode="scaleAspectFit"
          style={{ width: compact ? 21 : 23, height: compact ? 21 : 23 }}
        />
      ) : (
        <Text style={{ color: '#FFFFFF', fontSize: compact ? 22 : 24, fontWeight: '600' }}>
          {fallbackIcon}
        </Text>
      )}
    </Pressable>
  );
}
