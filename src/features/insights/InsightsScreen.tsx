import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { allocate } from '@/domain/category/share';
import { formatGhs, pesewas } from '@/domain/money';
import { SAMPLE_SPEND, ShareBar, ShareLegend } from '@/features/categories';
import { usePeriod } from '@/features/period';
import { MonthPill, Screen, ScreenTitle, SectionHeader, TAB_BAR_CLEARANCE } from '@/ui';

import { Legend, MonthlyChart, WeekdayChart } from './components/BarCharts';
import { MONTHS, WEEKDAYS, weekdaySpend, type WeekdayLabel } from './sample';

const SAMPLE_WEIGHTS = Object.fromEntries(SAMPLE_SPEND.map((s) => [s.categoryId, s.amount]));

export function InsightsScreen() {
  const router = useRouter();
  const { month } = usePeriod();
  const [weekday, setWeekday] = useState<WeekdayLabel>('Fri');

  const monthSpend = allocate(month.spent, SAMPLE_WEIGHTS);
  const day = WEEKDAYS.find((d) => d.label === weekday) ?? WEEKDAYS[4];
  const daySpend = weekdaySpend(weekday);

  return (
    <Screen testID="insightsScreen" bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle
        title="Insights"
        trailing={
          <MonthPill
            testID="insightsMonthPill"
            label={month.label}
            tone="light"
            onPress={() => router.push('/sheets/month')}
          />
        }
      />

      <View className="px-5 pt-9">
        <View className="pb-4">
          <SectionHeader title="Where it went" link={`${monthSpend.length} categories`} />
        </View>
        <ShareBar spend={monthSpend} />
        <ShareLegend spend={monthSpend} />
      </View>

      <View className="gap-1 px-5 pt-10">
        <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
          Fridays cost you most
        </Text>
        <Text className="font-inter text-[14px] leading-5 text-muted">
          Average spend by day of the week, last 3 months. Tap a day to see where it went.
        </Text>
        <WeekdayChart
          days={WEEKDAYS}
          selected={weekday}
          onSelect={(l) => setWeekday(l as WeekdayLabel)}
        />
      </View>

      <View testID="weekdayBreakdown" className="px-5 pt-8">
        <View className="pb-4">
          <SectionHeader
            title={`${day.name}s`}
            link={`${formatGhs(pesewas(day.cedis * 100))} on average`}
          />
        </View>
        <ShareBar spend={daySpend} />
        <ShareLegend spend={daySpend} />
      </View>

      <View className="gap-1 px-5 pt-10">
        <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
          August was your biggest month
        </Text>
        <Text className="font-inter text-[14px] leading-5 text-muted">
          Money out and in, May to October
        </Text>
        <Legend
          items={[
            { label: 'Out', color: '#14110F' },
            { label: 'In', color: '#CFCFCF' },
          ]}
        />
        <MonthlyChart months={MONTHS} />
      </View>
    </Screen>
  );
}
