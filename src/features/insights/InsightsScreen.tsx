import { Text, View } from 'react-native';

import { SAMPLE_SPEND, ShareBar, ShareLegend } from '@/features/categories';
import { MonthPill, Screen, ScreenTitle, SectionHeader, TAB_BAR_CLEARANCE } from '@/ui';

import { Legend, MonthlyChart, WeekdayChart } from './components/BarCharts';
import { MONTHS, WEEKDAYS } from './sample';

export function InsightsScreen() {
  return (
    <Screen bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle title="Insights" trailing={<MonthPill label="October 2026" tone="light" />} />

      <View className="px-5 pt-9">
        <View className="pb-4">
          <SectionHeader title="Where it went" link={`${SAMPLE_SPEND.length} categories`} />
        </View>
        <ShareBar spend={SAMPLE_SPEND} />
        <ShareLegend spend={SAMPLE_SPEND} />
      </View>

      <View className="gap-1 px-5 pt-10">
        <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">
          Fridays cost you most
        </Text>
        <Text className="font-inter text-[14px] leading-5 text-muted">
          Average spend by day of the week, last 3 months
        </Text>
        <WeekdayChart days={WEEKDAYS} />
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
