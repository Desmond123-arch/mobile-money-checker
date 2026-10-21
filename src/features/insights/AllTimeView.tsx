import { Text, View } from 'react-native';

import { monthLabel } from '@/domain/calendar/month';
import { formatGhs } from '@/domain/money';
import { spanLabel, yearBars } from '@/domain/summary/year';
import { ShareBar, ShareLegend } from '@/features/categories';
import { useCategorySpend } from '@/features/categories/useCategorySpend';
import { SectionHeader } from '@/ui';

import { Legend, MonthlyChart } from './components/BarCharts';
import { Notice } from './components/Notice';
import { Stat } from './components/Stats';
import { useAllTimeSummary } from './useInsights';

/** Years that still fit two bars each across a phone. */
const PAIRED_BARS_MAX_YEARS = 5;

export function AllTimeView() {
  const summary = useAllTimeSummary();
  const spend = useCategorySpend({ kind: 'all' });
  if (summary === undefined) return <View testID="insightsAllLoading" />;

  if (summary.firstMonthId === null || summary.lastMonthId === null) {
    return (
      <Notice
        testID="insightsAllEmpty"
        title="No payments yet."
        body="Once a payment is read from your messages, your whole history shows up here."
      />
    );
  }

  const compact = summary.years.length > PAIRED_BARS_MAX_YEARS;
  const { busiestYear, busiestMonth } = summary;

  return (
    <View testID="insightsAll" className="gap-1">
      <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
        Since your first payment
      </Text>
      <Text testID="insightsAllSpan" className="font-inter text-[14px] leading-5 text-muted">
        {spanLabel(summary.firstMonthId, summary.lastMonthId)}
      </Text>
      <View className="flex-row gap-2 pt-3">
        <Stat testID="insightsAllSpent" label="Spent" value={formatGhs(summary.spent)} />
        <Stat testID="insightsAllIn" label="Money in" value={formatGhs(summary.moneyIn)} />
        <Stat testID="insightsAllPayments" label="Payments" value={String(summary.payments)} />
      </View>

      <View className="gap-1 pt-10">
        <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
          {busiestYear ? `${busiestYear.year} was your busiest year` : 'Nothing spent yet'}
        </Text>
        <Text testID="insightsAllBusiest" className="font-inter text-[14px] leading-5 text-muted">
          {busiestYear && busiestMonth
            ? `${formatGhs(busiestYear.out)} out. Busiest month: ${monthLabel(busiestMonth.monthId)}, ${formatGhs(busiestMonth.out)}.`
            : 'Money out and in, year by year'}
        </Text>
        <Legend
          items={
            compact
              ? [{ label: 'Out', color: '#14110F' }]
              : [
                  { label: 'Out', color: '#14110F' },
                  { label: 'In', color: '#CFCFCF' },
                ]
          }
        />
        <View testID="insightsAllChart">
          <MonthlyChart months={yearBars(summary.years)} compact={compact} />
        </View>
      </View>

      {spend === undefined ? null : (
        <View className="pt-10">
          <View className="pb-4">
            <SectionHeader title="Where it went" link={`${spend.length} categories`} />
          </View>
          {spend.length === 0 ? (
            <Text className="font-inter text-body leading-6 text-muted">
              No spending to split by category.
            </Text>
          ) : (
            <>
              <ShareBar spend={spend} />
              <ShareLegend spend={spend} />
            </>
          )}
        </View>
      )}
    </View>
  );
}
