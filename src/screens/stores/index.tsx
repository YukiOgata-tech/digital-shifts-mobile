import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/data-state';
import { PageIntro } from '@/components/ui/page-intro';
import { SectionCard } from '@/components/ui/section-card';
import { StatusPill } from '@/components/ui/status-pill';
import { appRadii, appSpacing, useAppTheme } from '@/constants/app-theme';
import { useStaffIdentity } from '@/features/staff/queries';

export function StoresScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const staff = useStaffIdentity();

  if (staff.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="所属店舗を読み込んでいます…" />
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

  return (
    <AppScreen refreshing={staff.isLoading} onRefresh={() => void staff.refresh()}>
      <PageIntro
        eyebrow="Stores"
        title="所属店舗"
        description="打刻・シフト表示に使用する店舗を選択します。"
      />

      {staff.stores.length ? (
        staff.stores.map((store) => {
          const active = store.id === staff.activeStore?.id;
          return (
            <Pressable
              key={store.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => staff.setActiveStoreId(store.id)}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
              <SectionCard
                style={{
                  borderColor: active ? theme.brand : theme.border,
                  borderWidth: active ? 2 : 1,
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: appSpacing.md,
                  }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: appRadii.md,
                      backgroundColor: theme.brandSoft,
                    }}>
                    <Text style={{ color: theme.brandStrong, fontSize: 18, fontWeight: '900' }}>
                      店
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
                      {store.name}
                    </Text>
                    <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
                      {store.code ? `店舗コード: ${store.code}` : '店舗コード未設定'}
                    </Text>
                    {store.address ? (
                      <Text
                        selectable
                        style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
                        {store.address}
                      </Text>
                    ) : null}
                  </View>
                  <StatusPill label={active ? '選択中' : '選択'} tone={active ? 'brand' : 'neutral'} />
                </View>

                {active ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/(staff)/(attendance)')}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: appRadii.md,
                      backgroundColor: pressed ? theme.brandStrong : theme.brand,
                    })}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>
                      この店舗で打刻する
                    </Text>
                  </Pressable>
                ) : null}
              </SectionCard>
            </Pressable>
          );
        })
      ) : (
        <EmptyState
          title="所属店舗がありません"
          description="管理者に店舗への所属追加を依頼してください。"
        />
      )}
    </AppScreen>
  );
}
