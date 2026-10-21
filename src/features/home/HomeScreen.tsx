import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { dailyAverage } from '@/domain/summary/month';
import { ShareBar, ShareLegend, useCategories } from '@/features/categories';
import { useExpenses } from '@/features/expenses';
import { mergeSpend, mergeSummary, recentWithAdded } from '@/features/expenses/merge';
import { usePeriod, useToday } from '@/features/period';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { Screen, SectionHeader, TAB_BAR_CLEARANCE } from '@/ui';

import { DailyChart } from './components/DailyChart';
import { HeroSummary, TotalsRow } from './components/HeroSummary';
import { NeedsNoteCard } from './components/NeedsNoteCard';
import { HomeEmptyState } from './HomeEmptyState';
import { RECENT_COUNT, useHomeData } from './useHomeData';

export function HomeScreen() {
  const router = useRouter();
  const today = useToday();
  const { month: selected, hasData, ready } = usePeriod();
  const { added } = useExpenses();
  const data = useHomeData(selected.id);
  useCategories();

  if (!ready || data === undefined)
    return <View testID="homeLoading" className="flex-1 bg-ground" />;

  // Hand-added expenses belong to the month the device clock is in.
  const extras = selected.isCurrent ? added : [];
  const month = mergeSummary(data.summary, extras);
  const spend = mergeSpend(data.spend, extras);
  const recent = recentWithAdded(data.recent, extras, today, RECENT_COUNT);

  if (month.payments === 0) return <HomeEmptyState month={month} otherMonthsHaveData={hasData} />;

  return (
    <Screen testID="homeScreen" safeTop={false} bottomPad={TAB_BAR_CLEARANCE}>
      <HeroSummary
        monthLabel={month.label}
        onMonthPress={() => router.push('/sheets/month')}
        onFilterPress={() => router.push('/sheets/category-filter?goTo=transactions')}
        onAddPress={() => router.push('/sheets/add-expense')}
        spent={month.spent}
        delta={{ label: month.deltaLabel, compare: month.deltaCompare }}
      >
        <DailyChart daily={month.daily} today={month.today} peakLabel={month.peakLabel} />
        <TotalsRow
          moneyIn={month.moneyIn}
          payments={month.payments}
          average={dailyAverage(month.spent, month.today)}
        />
      </HeroSummary>

      {month.needNote > 0 ? (
        <NeedsNoteCard count={month.needNote} onPress={() => router.push('/sheets/add-note')} />
      ) : null}

      <View className="px-5 pt-9">
        <View className="pb-4">
          <SectionHeader
            title="Where it went"
            link="See insights"
            linkTestID="homeSeeInsightsLink"
            onLinkPress={() => router.push('/insights')}
          />
        </View>
        <ShareBar spend={spend} />
        <ShareLegend spend={spend} limit={3} />
      </View>

      <View className="px-5 pt-10">
        <View className="pb-2">
          <SectionHeader
            title="Recent"
            link={`See all ${month.payments}`}
            linkTestID="homeSeeAllLink"
            onLinkPress={() => router.push('/transactions')}
          />
        </View>
        {recent.map(({ row, when }) => (
          <TransactionRow
            key={row.id}
            row={row}
            when={when}
            padding="py-[14px]"
            onPress={() => router.push(`/transaction/${row.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}
