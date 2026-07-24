import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { NativeActionButton } from '@/components/ui/native-action-button';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { formatTime } from '@/features/staff/date';
import type { StorePublishedSchedule } from '@/features/staff/types';

const NAME_COLUMN_WIDTH = 116;
const DAY_COLUMN_WIDTH = 58;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  schedule: StorePublishedSchedule;
};

export function StoreScheduleSheet({ schedule }: Props) {
  const theme = useAppTheme();
  const viewShotRef = useRef<ViewShotRef>(null);
  const [isExporting, setIsExporting] = useState(false);
  const days = buildMonthDays(schedule.yearMonth);
  const tableWidth = NAME_COLUMN_WIDTH + days.length * DAY_COLUMN_WIDTH;
  const assignmentsByMemberDate = new Map<string, typeof schedule.assignments>();

  for (const assignment of schedule.assignments) {
    const key = `${assignment.userId}:${assignment.workDate}`;
    const items = assignmentsByMemberDate.get(key) ?? [];
    items.push(assignment);
    assignmentsByMemberDate.set(key, items);
  }

  const capture = async () => {
    if (!viewShotRef.current) throw new Error('シフト表の準備が完了していません。');
    return viewShotRef.current.capture();
  };

  const handleSave = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('端末用の機能です', '画像保存はiOS / Androidアプリで利用できます。');
      return;
    }
    setIsExporting(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert(
          '写真への追加が許可されていません',
          '端末の設定からDミセの写真追加を許可してください。',
        );
        return;
      }
      const uri = await capture();
      await MediaLibrary.Asset.create(uri);
      Alert.alert('保存しました', `${schedule.yearMonth}のシフト表を写真へ保存しました。`);
    } catch (error) {
      Alert.alert('保存できませんでした', toErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この端末では共有シートを利用できません。');
        return;
      }
      const uri = await capture();
      await Sharing.shareAsync(uri, {
        dialogTitle: `${schedule.storeName} ${schedule.yearMonth} シフト表`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error) {
      Alert.alert('共有できませんでした', toErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={{ gap: appSpacing.md }}>
      <View
        style={{
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: appRadii.md,
          borderCurve: 'continuous',
        }}>
        <ScrollView
          horizontal
          directionalLockEnabled
          showsHorizontalScrollIndicator
          contentContainerStyle={{ backgroundColor: '#FFFFFF' }}>
          <ViewShot
            ref={viewShotRef}
            options={{
              fileName: `dmise-${schedule.storeId}-${schedule.yearMonth}-shift`,
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            }}
            style={{ width: tableWidth, backgroundColor: '#FFFFFF' }}>
            <View style={{ padding: 16, gap: 12, backgroundColor: '#FFFFFF' }}>
              <View style={{ gap: 3 }}>
                <Text
                  style={{ color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
                  Dミセ · STORE SCHEDULE
                </Text>
                <Text style={{ color: '#0F172A', fontSize: 20, fontWeight: '900' }}>
                  {schedule.storeName}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '700' }}>
                  {formatMonthLabel(schedule.yearMonth)} 公開シフト
                </Text>
              </View>

              <View style={{ borderWidth: 1, borderColor: '#CBD5E1' }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9' }}>
                  <SheetCell width={NAME_COLUMN_WIDTH} borderLeft={false}>
                    <Text style={{ color: '#334155', fontSize: 11, fontWeight: '900' }}>
                      スタッフ
                    </Text>
                  </SheetCell>
                  {days.map((day) => (
                    <SheetCell key={day.dateKey} width={DAY_COLUMN_WIDTH}>
                      <Text
                        style={{
                          color: day.weekday === 0 ? '#E11D48' : day.weekday === 6 ? '#0369A1' : '#334155',
                          fontSize: 11,
                          fontWeight: '900',
                        }}>
                        {day.day}
                      </Text>
                      <Text
                        style={{
                          color: day.weekday === 0 ? '#E11D48' : day.weekday === 6 ? '#0369A1' : '#64748B',
                          fontSize: 9,
                          fontWeight: '800',
                        }}>
                        {WEEKDAYS[day.weekday]}
                      </Text>
                    </SheetCell>
                  ))}
                </View>

                {schedule.members.map((member, memberIndex) => (
                  <View
                    key={member.userId}
                    style={{
                      flexDirection: 'row',
                      borderTopWidth: 1,
                      borderTopColor: '#CBD5E1',
                      backgroundColor: memberIndex % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                    }}>
                    <SheetCell width={NAME_COLUMN_WIDTH} borderLeft={false}>
                      <Text
                        numberOfLines={2}
                        style={{ color: '#0F172A', fontSize: 10, fontWeight: '900' }}>
                        {member.displayName}
                      </Text>
                    </SheetCell>
                    {days.map((day) => {
                      const items =
                        assignmentsByMemberDate.get(`${member.userId}:${day.dateKey}`) ?? [];
                      return (
                        <SheetCell key={day.dateKey} width={DAY_COLUMN_WIDTH}>
                          {items.length ? (
                            items.map((item) => (
                              <View key={item.id} style={{ alignItems: 'center' }}>
                                {item.timeSlotLabel ? (
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: '#059669', fontSize: 8, fontWeight: '900' }}>
                                    {item.timeSlotLabel}
                                  </Text>
                                ) : null}
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: '#0F172A',
                                    fontSize: 8,
                                    fontWeight: '800',
                                    fontVariant: ['tabular-nums'],
                                  }}>
                                  {formatTime(item.startAt)}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: '#475569',
                                    fontSize: 8,
                                    fontWeight: '700',
                                    fontVariant: ['tabular-nums'],
                                  }}>
                                  {formatTime(item.endAt)}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={{ color: '#CBD5E1', fontSize: 9 }}>—</Text>
                          )}
                        </SheetCell>
                      );
                    })}
                  </View>
                ))}
              </View>

              <Text style={{ color: '#94A3B8', fontSize: 9 }}>
                公開済みの確定シフトのみ表示しています。
              </Text>
            </View>
          </ViewShot>
        </ScrollView>
      </View>

      <Text selectable style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
        表を左右にスクロールして確認できます。保存時は月全体を1枚の画像にします。
      </Text>

      <View style={{ gap: appSpacing.sm }}>
        <NativeActionButton
          label={isExporting ? '画像を準備中…' : 'シフト表を写真に保存'}
          onPress={() => void handleSave()}
          disabled={isExporting}
          haptic="success"
        />
        <NativeActionButton
          label="画像を共有"
          onPress={() => void handleShare()}
          disabled={isExporting}
          variant="outlined"
        />
      </View>
    </View>
  );
}

function SheetCell({
  children,
  width,
  borderLeft = true,
}: {
  children: React.ReactNode;
  width: number;
  borderLeft?: boolean;
}) {
  return (
    <View
      style={{
        width,
        minHeight: 52,
        paddingHorizontal: 3,
        paddingVertical: 5,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderLeftWidth: borderLeft ? 1 : 0,
        borderLeftColor: '#CBD5E1',
      }}>
      {children}
    </View>
  );
}

function buildMonthDays(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const dateKey = `${yearMonth}-${String(day).padStart(2, '0')}`;
    return { dateKey, day, weekday: new Date(`${dateKey}T00:00:00+09:00`).getDay() };
  });
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  return `${year}年${Number(month)}月`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '時間を置いてもう一度お試しください。';
}
