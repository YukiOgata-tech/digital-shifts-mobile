import { useLocalSearchParams } from 'expo-router';

import { StoreScheduleSheet } from '@/components/shifts/store-schedule-sheet';
import { AppScreen } from '@/components/ui/app-screen';
import { TabStackBackButton } from '@/components/navigation/tab-stack-back-button';
import { ErrorState, LoadingState } from '@/components/ui/data-state';
import { PageIntro } from '@/components/ui/page-intro';
import { SectionCard } from '@/components/ui/section-card';
import { useStorePublishedSchedule } from '@/features/staff/queries';

export function StoreScheduleScreen() {
  const params = useLocalSearchParams<{
    storeId?: string | string[];
    storeName?: string | string[];
    yearMonth?: string | string[];
    periodName?: string | string[];
  }>();
  const storeId = firstParam(params.storeId);
  const storeName = firstParam(params.storeName);
  const yearMonth = firstParam(params.yearMonth);
  const periodName = firstParam(params.periodName);
  const schedule = useStorePublishedSchedule(
    yearMonth ?? '',
    storeId && storeName ? { id: storeId, name: storeName } : undefined,
  );

  if (!storeId || !storeName || !yearMonth) {
    return (
      <AppScreen>
        <ErrorState message="表示するシフト期間を確認できませんでした。" />
      </AppScreen>
    );
  }

  if (schedule.isLoading) {
    return (
      <AppScreen>
        <LoadingState label="全員のシフト表を準備しています…" />
      </AppScreen>
    );
  }

  if (schedule.error || !schedule.data) {
    return (
      <AppScreen>
        <ErrorState
          message={schedule.error?.message}
          onRetry={() => void schedule.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      refreshing={schedule.isFetching}
      onRefresh={() => void schedule.refetch()}>
      <TabStackBackButton fallback="/(staff)/(shifts)" label="シフト" />
      <PageIntro
        eyebrow="Shift sheet"
        title={periodName ?? yearMonth}
        description={`${storeName}の公開済み全員シフト表です。`}
      />
      <SectionCard>
        <StoreScheduleSheet schedule={schedule.data} />
      </SectionCard>
    </AppScreen>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
