import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ShareBar, ShareLegend, SAMPLE_SPEND } from '@/features/categories';
import { usePeriod } from '@/features/period';
import { useExpenses } from '@/features/expenses';
import { pesewas } from '@/domain/money';
import type { CategorySpend } from '@/domain/category/share';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { SAMPLE_RECENT } from '@/features/transactions/sample';
import { Screen, SectionHeader, TAB_BAR_CLEARANCE } from '@/ui';

import { DailyChart } from './components/DailyChart';
import { HeroSummary, TotalsRow } from './components/HeroSummary';
import { NeedsNoteCard } from './components/NeedsNoteCard';
import { HomeEmptyState } from './HomeEmptyState';
import { summaryFor } from './sample';

export function HomeScreen() {
  const router = useRouter();
  const { month: selected } = usePeriod();
  const { added } = useExpenses();
  const base = summaryFor(selected);
  const extras = selected.isCurrent ? added : [];
  const extraTotal = extras.reduce((sum, a) => sum + a.row.amount, 0);
  const month = {
    ...base,
    spent: pesewas(base.spent + extraTotal),
    payments: base.payments + extras.length,
  };
  const spend = extras.reduce<CategorySpend[]>(
    (all, a) => {
      const id = a.row.categoryId ?? 'other';
      const found = all.find((s) => s.categoryId === id);
      return found
        ? all.map((s) => (s === found ? { ...s, amount: pesewas(s.amount + a.row.amount) } : s))
        : [...all, { categoryId: id, amount: a.row.amount }];
    },
    [...SAMPLE_SPEND],
  );
  const recent = [
    ...extras.map((a) => ({ row: a.row, when: a.day === 'today' ? 'Today' : 'Yesterday' })),
    ...SAMPLE_RECENT,
  ].slice(0, 3);

  if (month.payments === 0) return <HomeEmptyState month={month} />;

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
        <TotalsRow moneyIn={month.moneyIn} payments={month.payments} />
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
