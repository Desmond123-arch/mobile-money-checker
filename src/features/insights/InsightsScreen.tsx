import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { dayState, longDate, shortDate, weekdayName } from '@/domain/calendar/week';
import type { CategorySpend } from '@/domain/category/share';
import { formatGhs, pesewas } from '@/domain/money';
import { monthBars, trendHeading } from '@/domain/summary/trend';
import { ShareBar, ShareLegend } from '@/features/categories';
import { useCategorySpend } from '@/features/categories/useCategorySpend';
import { usePeriod, useToday } from '@/features/period';
import {
  ClearButton,
  MonthPill,
  Screen,
  ScreenTitle,
  SectionHeader,
  TAB_BAR_CLEARANCE,
} from '@/ui';

import { Legend, MonthlyChart } from './components/BarCharts';
import { Notice } from './components/Notice';
import { AllTimeView } from './AllTimeView';
import { YearView } from './YearView';
import { useDaySpend, useMonthlyFlows, useWeekdayAverage } from './useInsights';

export function InsightsScreen() {
  const router = useRouter();
  const today = useToday();
  const { period, scope, month, selectMonth } = usePeriod();
  const flows = useMonthlyFlows(month.id);

  const openCalendar = () => router.push('/sheets/calendar');
  const label =
    scope.kind === 'year'
      ? String(scope.year)
      : scope.kind === 'all'
        ? 'All time'
        : period.kind === 'day'
          ? shortDate(period.iso)
          : month.label;
  const heading = flows ? trendHeading(flows) : null;

  return (
    <Screen testID="insightsScreen" bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle
        title="Insights"
        trailing={
          <MonthPill
            testID="insightsPeriodPill"
            label={label}
            tone="light"
            onPress={openCalendar}
          />
        }
      />

      {scope.kind === 'year' || scope.kind === 'all' ? (
        <View className="px-5 pt-9">
          {scope.kind === 'year' ? <YearView year={scope.year} /> : <AllTimeView />}
        </View>
      ) : (
        <View testID="insightsWhereItWent" className="px-5 pt-9">
          {period.kind === 'month' ? (
            <MonthContent monthId={month.id} monthLabel={month.label} />
          ) : (
            <DayContent
              iso={period.iso}
              state={dayState(period.iso, today)}
              onWholeMonth={() => selectMonth(month.id)}
            />
          )}
        </View>
      )}

      {(scope.kind === 'day' || scope.kind === 'month') && flows && heading ? (
        <View className="gap-1 px-5 pt-10">
          <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
            {heading.title}
          </Text>
          <Text className="font-inter text-[14px] leading-5 text-muted">{heading.subtitle}</Text>
          <Legend
            items={[
              { label: 'Out', color: '#14110F' },
              { label: 'In', color: '#CFCFCF' },
            ]}
          />
          <MonthlyChart months={monthBars(flows)} />
        </View>
      ) : null}
    </Screen>
  );
}

function MonthContent({ monthId, monthLabel }: { monthId: string; monthLabel: string }) {
  const spend = useCategorySpend({ kind: 'month', monthId });
  if (spend === undefined) return null;
  return (
    <>
      <View className="pb-4">
        <SectionHeader title="Where it went" link={`${spend.length} categories`} />
      </View>
      {spend.length === 0 ? (
        <Notice
          testID="insightsMonthEmpty"
          title="No payments this month."
          body={`Nothing was spent in ${monthLabel}.`}
        />
      ) : (
        <>
          <ShareBar spend={spend} />
          <ShareLegend spend={spend} />
        </>
      )}
    </>
  );
}

function DayContent({
  iso,
  state,
  onWholeMonth,
}: {
  iso: string;
  state: ReturnType<typeof dayState>;
  onWholeMonth: () => void;
}) {
  const day = useDaySpend(iso, state !== 'future');
  const name = weekdayName(iso);
  const typical = useWeekdayAverage(new Date(`${iso}T00:00:00Z`).getUTCDay(), state === 'future');
  const total = day?.total ?? pesewas(0);
  const spend: CategorySpend[] = day?.spend ?? [];

  return (
    <>
      <View className="flex-row items-center justify-between pb-1">
        <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
          Where it went
        </Text>
        <ClearButton testID="insightsWholeMonth" label="Whole month" onPress={onWholeMonth} />
      </View>
      <Text testID="insightsDayLabel" className="pb-4 font-inter text-[14px] leading-5 text-muted">
        {longDate(iso)}
        {state === 'today' ? ' · so far today' : ''}
        {state !== 'future' && total > 0 ? ` · ${formatGhs(total)}` : ''}
      </Text>

      {state === 'future' ? (
        <>
          <Notice
            testID="insightsDayFuture"
            title="This day has not happened yet."
            body={`${longDate(iso)} is still ahead. Here is what an average ${name} looks like.`}
          />
          {typical && typical.spend.length > 0 ? (
            <>
              <View className="pt-6">
                <SectionHeader title={`An average ${name}`} link={formatGhs(typical.total)} />
              </View>
              <View className="pt-4">
                <ShareBar spend={typical.spend} />
                <ShareLegend spend={typical.spend} />
              </View>
            </>
          ) : null}
        </>
      ) : day === undefined ? null : total === 0 ? (
        <Notice
          testID="insightsDayEmpty"
          title="No payments this day."
          body={`Nothing was spent on ${shortDate(iso)}.`}
        />
      ) : (
        <>
          <ShareBar spend={spend} />
          <ShareLegend spend={spend} />
        </>
      )}
    </>
  );
}
