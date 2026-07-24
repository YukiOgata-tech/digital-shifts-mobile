import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { AppScreen } from '@/components/ui/app-screen';
import { LoadingState } from '@/components/ui/data-state';
import { NativeActionButton } from '@/components/ui/native-action-button';
import { SectionCard } from '@/components/ui/section-card';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import {
  clearMobilePreferences,
  DEFAULT_MOBILE_PREFERENCES,
  type DayDefault,
  type MobilePreferences,
  readMobilePreferences,
  writeMobilePreferences,
} from '@/features/preferences/mobile-preferences';
import { useStaffIdentity } from '@/features/staff/queries';

const WEEKDAYS = [
  { short: '日', long: '日曜日' },
  { short: '月', long: '月曜日' },
  { short: '火', long: '火曜日' },
  { short: '水', long: '水曜日' },
  { short: '木', long: '木曜日' },
  { short: '金', long: '金曜日' },
  { short: '土', long: '土曜日' },
];

export function PreferencesScreen() {
  const theme = useAppTheme();
  const staff = useStaffIdentity();
  const [preferences, setPreferences] = useState<MobilePreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!staff.userId) return;
    let active = true;
    void readMobilePreferences(staff.userId).then((value) => {
      if (active) setPreferences(value);
    });
    return () => {
      active = false;
    };
  }, [staff.userId]);

  if (staff.isLoading || !preferences) {
    return (
      <AppScreen>
        <LoadingState label="操作設定を読み込んでいます…" />
      </AppScreen>
    );
  }

  const updateDay = (
    index: number,
    patch: Partial<NonNullable<DayDefault>> & { enabled?: boolean },
  ) => {
    setPreferences((current) => {
      if (!current) return current;
      const schedule = [...current.defaultSchedule];
      if (patch.enabled === false) {
        schedule[index] = null;
      } else {
        const existing = schedule[index] ?? {
          entryType: 'available',
          isAllDay: false,
          startTime: '09:00',
          endTime: '17:00',
        };
        const { enabled: _enabled, ...values } = patch;
        schedule[index] = {
          ...existing,
          ...values,
          isAllDay:
            values.entryType === 'unavailable'
              ? true
              : (values.isAllDay ?? existing.isAllDay),
        };
      }
      return { ...current, defaultSchedule: schedule };
    });
  };

  const save = async () => {
    if (!staff.userId) return;
    const invalidDay = preferences.defaultSchedule.find(
      (day) =>
        day &&
        !day.isAllDay &&
        (!/^([01]\d|2[0-3]):[0-5]\d$/.test(day.startTime) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.endTime)),
    );
    if (invalidDay) {
      Alert.alert('時刻を確認してください', '開始・終了は00:00〜23:59の形式で入力してください。');
      return;
    }
    setSaving(true);
    try {
      await writeMobilePreferences(staff.userId, preferences);
      Alert.alert('操作・データ設定を保存しました');
    } catch (error) {
      Alert.alert(
        '設定を保存できませんでした',
        error instanceof Error ? error.message : 'もう一度お試しください。',
      );
    } finally {
      setSaving(false);
    }
  };

  const resetDefaultSchedule = async () => {
    if (!staff.userId) return;
    const next = {
      ...preferences,
      defaultSchedule: Array.from({ length: 7 }, () => null),
    };
    setSaving(true);
    try {
      await writeMobilePreferences(staff.userId, next);
      setPreferences(next);
      Alert.alert('曜日別デフォルトをリセットしました');
    } catch (error) {
      Alert.alert(
        'リセットできませんでした',
        error instanceof Error ? error.message : 'もう一度お試しください。',
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    Alert.alert(
      'この端末の操作設定をリセットしますか？',
      '曜日別初期値と日付タップの動作を初期状態へ戻します。ログイン状態や提出済みデータは削除しません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: () => {
            if (!staff.userId) return;
            void clearMobilePreferences(staff.userId)
              .then(() => {
                setPreferences(DEFAULT_MOBILE_PREFERENCES);
                Alert.alert('端末の操作設定をリセットしました');
              })
              .catch((error: Error) =>
                Alert.alert('リセットできませんでした', error.message),
              );
          },
        },
      ],
    );
  };

  return (
    <AppScreen contentContainerStyle={{ paddingTop: appSpacing.sm }}>
      <TabStackBackButton fallback="/(staff)/(settings)" label="設定" />
      <View style={{ paddingHorizontal: appSpacing.xs, gap: 2 }}>
        <Text style={{ color: theme.brandStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 }}>
          PREFERENCES
        </Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900' }}>
          操作・データ設定
        </Text>
      </View>

      <SectionCard>
        <SectionHeading
          title="表示言語"
          description="スタッフ向け画面の表示言語です。現在のネイティブ版は日本語表示を先行しています。"
        />
        <View style={{ flexDirection: 'row', gap: appSpacing.sm }}>
          <ChoiceButton
            label="日本語"
            selected={preferences.locale === 'ja'}
            onPress={() => setPreferences({ ...preferences, locale: 'ja' })}
          />
          <ChoiceButton
            label="English（準備中）"
            selected={false}
            disabled
            onPress={() => undefined}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <SectionHeading
          title="曜日別デフォルトシフト"
          description="希望シフト提出で日付をタップしたとき、その曜日の初期値を反映します。未設定の曜日は現在選択中の入力ブラシを使います。"
        />
        {WEEKDAYS.map((weekday, index) => (
          <DayCard
            key={weekday.long}
            index={index}
            shortLabel={weekday.short}
            name={weekday.long}
            value={preferences.defaultSchedule[index]}
            disabled={saving}
            onToggle={(enabled) => updateDay(index, { enabled })}
            onChange={(patch) => updateDay(index, patch)}
          />
        ))}
        <NativeActionButton
          label={saving ? '保存中…' : 'デフォルトを保存'}
          disabled={saving}
          onPress={() => void save()}
        />
        <NativeActionButton
          label="すべてリセット"
          variant="outlined"
          tone="dark"
          disabled={saving}
          onPress={() => void resetDefaultSchedule()}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeading
          title="日付タップの動作"
          description="なぞり入力中は選択中のブラシが優先されます。"
        />
        <ChoiceButton
          label="曜日別初期値を使う"
          selected={preferences.tapBehavior === 'weekday-default'}
          onPress={() =>
            setPreferences({ ...preferences, tapBehavior: 'weekday-default' })
          }
        />
        <ChoiceButton
          label="現在の入力ブラシを使う"
          selected={preferences.tapBehavior === 'current-brush'}
          onPress={() =>
            setPreferences({ ...preferences, tapBehavior: 'current-brush' })
          }
        />
        <NativeActionButton
          label={saving ? '保存中…' : '操作設定を保存'}
          tone="dark"
          disabled={saving}
          onPress={() => void save()}
        />
      </SectionCard>

      <SectionCard tone="brand">
        <SectionHeading
          title="モバイルアプリのデータ利用"
          description="このネイティブアプリは、ブラウザCookieを使用しません。"
        />
        <PolicyLine
          title="ログイン情報"
          description="iOS／Androidの保護された安全な保存領域に保持します。"
        />
        <PolicyLine
          title="業務データ"
          description="シフト、打刻、通知、プロフィールは認証されたSupabaseへ保存します。"
        />
        <PolicyLine
          title="端末内の操作設定"
          description="曜日別初期値、日付タップの動作、選択中の店舗はこの端末内に保存します。"
        />
        <PolicyLine
          title="位置情報と通知"
          description="打刻時の範囲確認とPush通知にだけ使用し、許可は端末の設定からいつでも変更できます。"
        />
        <Text style={{ color: theme.brandStrong, fontSize: 11, lineHeight: 17 }}>
          アプリ削除や端末データ消去で端末内設定は消えますが、Supabaseに保存された提出・打刻データは消えません。
        </Text>
        <NativeActionButton
          label="この端末の操作設定をリセット"
          variant="outlined"
          tone="dark"
          onPress={reset}
        />
      </SectionCard>
    </AppScreen>
  );
}

function DayCard({
  index,
  shortLabel,
  name,
  value,
  disabled,
  onToggle,
  onChange,
}: {
  index: number;
  shortLabel: string;
  name: string;
  value: DayDefault;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onChange: (patch: Partial<NonNullable<DayDefault>>) => void;
}) {
  const theme = useAppTheme();
  const enabled = value !== null;
  const day = value ?? {
    entryType: 'available' as const,
    isAllDay: false,
    startTime: '09:00',
    endTime: '17:00',
  };
  const dayColor = index === 0 ? theme.danger : index === 6 ? theme.info : theme.text;

  return (
    <View
      style={{
        padding: appSpacing.md,
        gap: appSpacing.md,
        borderRadius: appRadii.md,
        borderWidth: 1,
        borderColor: enabled ? theme.brand : theme.border,
        backgroundColor: enabled ? theme.brandSoft : theme.surface,
      }}>
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: appRadii.sm,
            backgroundColor: theme.surfaceMuted,
          }}>
          <Text style={{ color: dayColor, fontSize: 14, fontWeight: '900' }}>{shortLabel}</Text>
        </View>
        <Text style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: '900' }}>{name}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>デフォルト</Text>
        <Switch
          accessibilityLabel={`${name}のデフォルト`}
          value={enabled}
          disabled={disabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: theme.brandBright }}
          thumbColor={theme.surface}
        />
      </View>
      {enabled ? (
        <>
          <View style={{ flexDirection: 'row', gap: appSpacing.xs }}>
            <MiniChoice
              label="勤務可"
              selected={day.entryType === 'available'}
              onPress={() => onChange({ entryType: 'available' })}
            />
            <MiniChoice
              label="優先"
              selected={day.entryType === 'preferred'}
              onPress={() => onChange({ entryType: 'preferred' })}
            />
            <MiniChoice
              label="NG"
              selected={day.entryType === 'unavailable'}
              onPress={() => onChange({ entryType: 'unavailable', isAllDay: true })}
            />
          </View>
          {day.entryType !== 'unavailable' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: '800' }}>終日</Text>
                <Switch
                  accessibilityLabel={`${name}を終日にする`}
                  value={day.isAllDay}
                  onValueChange={(isAllDay) => onChange({ isAllDay })}
                  trackColor={{ false: theme.border, true: theme.brandBright }}
                  thumbColor={theme.surface}
                />
              </View>
              {!day.isAllDay ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: appSpacing.sm }}>
                  <TimeInput value={day.startTime} onChangeText={(startTime) => onChange({ startTime })} />
                  <Text style={{ color: theme.textSecondary }}>–</Text>
                  <TimeInput value={day.endTime} onChangeText={(endTime) => onChange({ endTime })} />
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{ color: theme.danger, fontSize: 11, fontWeight: '700' }}>
              NGは終日固定です。
            </Text>
          )}
        </>
      ) : (
        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
          この曜日は初期値なし（選択中の入力ブラシを使用）
        </Text>
      )}
    </View>
  );
}

function TimeInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const theme = useAppTheme();
  return (
    <TextInput
      accessibilityLabel="時刻"
      value={value}
      maxLength={5}
      keyboardType="numbers-and-punctuation"
      onChangeText={onChangeText}
      placeholder="09:00"
      placeholderTextColor={theme.textSecondary}
      style={{
        minHeight: 44,
        flex: 1,
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.sm,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        color: theme.text,
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
      }}
    />
  );
}

function ChoiceButton({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: appSpacing.md,
        borderRadius: appRadii.md,
        borderWidth: 1,
        borderColor: selected ? theme.hero : theme.border,
        backgroundColor: selected ? theme.hero : theme.surface,
        opacity: disabled ? 0.42 : pressed ? 0.65 : 1,
      })}>
      <Text style={{ color: selected ? theme.heroText : theme.text, fontSize: 13, fontWeight: '900' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function MiniChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
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
        minHeight: 44,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: appRadii.sm,
        borderWidth: 1,
        borderColor: selected ? theme.brand : theme.border,
        backgroundColor: selected ? theme.brand : theme.surface,
        opacity: pressed ? 0.65 : 1,
      })}>
      <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 19 }}>{description}</Text>
    </View>
  );
}

function PolicyLine({ title, description }: { title: string; description: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 17 }}>{description}</Text>
    </View>
  );
}
