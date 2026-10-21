import { Text, View } from 'react-native';

import { monthLabel, monthName } from '@/domain/calendar/month';
import { formatGhs } from '@/domain/money';
import { compareSpend } from '@/domain/summary/compare';
import { monthBars } from '@/domain/summary/trend';
import { ShareBar, ShareLegend } from '@/features/categories';
import { useCategorySpend } from '@/features/categories/useCategorySpend';
import { SectionHeader } from '@/ui';

import { Legend, MonthlyChart } from './components/BarCharts';
import { Notice } from './components/Notice';
import { ComparisonLine, Stat } from './components/Stats';
import { useYearSummary } from './useInsights';

export function YearView({ year }: { year: number }) {
  const summary = useYearSummary(year);
  const spend = useCategorySpend({ kind: 'year', year });
  if (summary === undefined || summary.year !== year) {
    return <View testID="insightsYearLoading" />;
  }

  if (summary.payments === 0 && summary.spent === 0 && summary.moneyIn === 0) {
    return (
      <Notice
        testID="insightsYearEmpty"
        title="No payments this year."
        body={`Nothing was spent or received in ${year}.`}
      />
    );
  }

  const comparison = compareSpend(summary.spent, summary.previousSpent, String(year - 1));
  const biggest = summary.biggestMonth;

  return (
    <View testID="insightsYear" className="gap-1">
      <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
        {year} in total
      </Text>
      <View className="flex-row gap-2 pt-3">
        <Stat testID="insightsYearSpent" label="Spent" value={formatGhs(summary.spent)} />
        <Stat testID="insightsYearIn" label="Money in" value={formatGhs(summary.moneyIn)} />
        <Stat testID="insightsYearPayments" label="Payments" value={String(summary.payments)} />
      </View>
      {comparison ? (
        <ComparisonLine testID="insightsYearComparison" comparison={comparison} />
      ) : null}

      <View className="gap-1 pt-10">
        <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
          {biggest ? `${monthName(biggest.monthId)} was your biggest month` : 'Nothing spent'}
        </Text>
        <Text testID="insightsYearBiggest" className="font-inter text-[14px] leading-5 text-muted">
          {biggest
            ? `${monthLabel(biggest.monthId)}, ${formatGhs(biggest.out)} out`
            : `Money out by month, ${year}`}
        </Text>
        <Legend items={[{ label: 'Out', color: '#14110F' }]} />
        <View testID="insightsYearChart">
          <MonthlyChart months={monthBars(summary.months)} compact />
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
