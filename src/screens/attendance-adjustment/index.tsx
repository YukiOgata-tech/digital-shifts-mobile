import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { toDateKey } from '@/features/staff/date';
import { useStaffIdentity, useSubmitManualAttendance } from '@/features/staff/queries';

export function AttendanceAdjustmentScreen() {
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const mutation = useSubmitManualAttendance();
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clockIn, setClockIn] = useState('11:00');
  const [clockOut, setClockOut] = useState('19:00');
  const [breakMinutes, setBreakMinutes] = useState('60');
  const [reason, setReason] = useState('');

  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);

  const submit = () => {
    if (!staff.activeStore) {
      Alert.alert('店舗を確認できません', 'プロフィール設定で利用する店舗を選択してください。');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(clockIn) || !/^\d{2}:\d{2}$/.test(clockOut)) {
      Alert.alert('時刻を確認してください', '時刻は11:00の形式で入力してください。');
      return;
    }
    const parsedBreakMinutes = Number(breakMinutes);
    if (!Number.isInteger(parsedBreakMinutes) || parsedBreakMinutes < 0 || parsedBreakMinutes > 480) {
      Alert.alert('休憩時間を確認してください', '0〜480分で入力してください。');
      return;
    }
    if (reason.trim().length < 5) {
      Alert.alert('理由を入力してください', '理由は5文字以上で入力してください。');
      return;
    }

    Alert.alert(
      '勤怠を後から入力しますか？',
      '保存後は要確認となり、管理者の確認対象になります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '入力する',
          onPress: () =>
            mutation.mutate(
              {
                storeId: staff.activeStore!.id,
                workDate: toDateKey(date),
                clockIn,
                clockOut,
                breakMinutes: parsedBreakMinutes,
                reason,
              },
              {
                onSuccess: () =>
                  Alert.alert(
                    '入力しました',
                    '勤怠へ保存し、管理者の確認対象にしました。',
                  ),
                onError: (error) => Alert.alert('入力できませんでした', error.message),
              },
            ),
        },
      ],
    );
  };

  return (
    <AppScreen contentContainerStyle={{ paddingTop: appSpacing.xl }}>
      <TabStackBackButton fallback="/(staff)/(attendance)" label="打刻履歴" />
      <Text selectable style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
        打刻漏れがあった勤務を後から入力します。既存の勤怠と重なる時間は保存できず、保存した内容は管理者の確認対象になります。
      </Text>

      <SectionCard>
        <View style={{ gap: appSpacing.sm }}>
          <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
            対象日
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => ({
              minHeight: 50,
              justifyContent: 'center',
              paddingHorizontal: appSpacing.lg,
              borderRadius: appRadii.md,
              borderCurve: 'continuous',
              backgroundColor: pressed ? theme.border : theme.surfaceMuted,
            })}>
            <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
              {dateLabel}
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              display={process.env.EXPO_OS === 'ios' ? 'inline' : 'calendar'}
              accentColor={theme.brand}
              locale="ja_JP"
              onDismiss={() => setShowDatePicker(false)}
              onValueChange={(_, value) => {
                setDate(value);
                if (process.env.EXPO_OS !== 'ios') {
                  setShowDatePicker(false);
                }
              }}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: appSpacing.md }}>
          <View style={{ flex: 1, gap: appSpacing.sm }}>
            <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              出勤時刻
            </Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              value={clockIn}
              onChangeText={setClockIn}
              placeholder="11:00"
              placeholderTextColor={theme.textSecondary}
              style={{
                minHeight: 50,
                paddingHorizontal: appSpacing.lg,
                color: theme.text,
                backgroundColor: theme.surfaceMuted,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                fontSize: 17,
                fontVariant: ['tabular-nums'],
              }}
            />
          </View>
          <View style={{ flex: 1, gap: appSpacing.sm }}>
            <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              退勤時刻
            </Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              value={clockOut}
              onChangeText={setClockOut}
              placeholder="19:00"
              placeholderTextColor={theme.textSecondary}
              style={{
                minHeight: 50,
                paddingHorizontal: appSpacing.lg,
                color: theme.text,
                backgroundColor: theme.surfaceMuted,
                borderRadius: appRadii.md,
                borderCurve: 'continuous',
                fontSize: 17,
                fontVariant: ['tabular-nums'],
              }}
            />
          </View>
        </View>

        <View style={{ gap: appSpacing.sm }}>
          <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
            休憩時間（分）
          </Text>
          <TextInput
            keyboardType="number-pad"
            value={breakMinutes}
            onChangeText={setBreakMinutes}
            placeholder="60"
            placeholderTextColor={theme.textSecondary}
            style={{
              minHeight: 50,
              paddingHorizontal: appSpacing.lg,
              color: theme.text,
              backgroundColor: theme.surfaceMuted,
              borderRadius: appRadii.md,
              borderCurve: 'continuous',
              fontSize: 17,
              fontVariant: ['tabular-nums'],
            }}
          />
        </View>

        <View style={{ gap: appSpacing.sm }}>
          <Text selectable style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
            修正理由
          </Text>
          <TextInput
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={reason}
            onChangeText={setReason}
            placeholder="例：退勤時の打刻を忘れたため"
            placeholderTextColor={theme.textSecondary}
            style={{
              minHeight: 112,
              padding: appSpacing.lg,
              color: theme.text,
              backgroundColor: theme.surfaceMuted,
              borderRadius: appRadii.md,
              borderCurve: 'continuous',
              fontSize: 16,
              lineHeight: 22,
            }}
          />
        </View>
      </SectionCard>

      <NativeActionButton
        label="勤怠を後から入力する"
        loading={mutation.isPending}
        loadingLabel="入力中…"
        disabled={reason.trim().length < 5 || mutation.isPending}
        haptic="success"
        onPress={submit}
      />
    </AppScreen>
  );
}
