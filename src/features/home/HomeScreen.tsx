import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ShareBar, ShareLegend, SAMPLE_SPEND } from '@/features/categories';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { SAMPLE_RECENT } from '@/features/transactions/sample';
import { Screen, SectionHeader, TAB_BAR_CLEARANCE } from '@/ui';

import { DailyChart } from './components/DailyChart';
import { HeroSummary, TotalsRow } from './components/HeroSummary';
import { NeedsNoteCard } from './components/NeedsNoteCard';
import { HomeEmptyState } from './HomeEmptyState';
import { SAMPLE_MONTH } from './sample';

export function HomeScreen() {
  const router = useRouter();
  const month = SAMPLE_MONTH;

  if (month.payments === 0) return <HomeEmptyState month={month} />;

  return (
    <Screen safeTop={false} bottomPad={TAB_BAR_CLEARANCE}>
      <HeroSummary
        monthLabel={month.label}
        spent={month.spent}
        delta={{ label: month.deltaLabel, compare: month.deltaCompare }}
      >
        <DailyChart daily={month.daily} today={month.today} peakLabel={month.peakLabel} />
        <TotalsRow
          moneyIn={month.moneyIn}
          feesAndTax={month.feesAndTax}
          payments={month.payments}
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
            onLinkPress={() => router.push('/insights')}
          />
        </View>
        <ShareBar spend={SAMPLE_SPEND} />
        <ShareLegend spend={SAMPLE_SPEND} limit={3} />
      </View>

      <View className="px-5 pt-10">
        <View className="pb-2">
          <SectionHeader
            title="Recent"
            link={`See all ${month.payments}`}
            onLinkPress={() => router.push('/transactions')}
          />
        </View>
        {SAMPLE_RECENT.map(({ row, when }) => (
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
