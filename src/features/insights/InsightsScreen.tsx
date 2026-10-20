import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { allocate } from '@/domain/category/share';
import { dayState, longDate, shortDate, weekdayLabel, weekdayName } from '@/domain/calendar/week';
import { formatGhs, pesewas } from '@/domain/money';
import { SAMPLE_SPEND, ShareBar, ShareLegend } from '@/features/categories';
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
import { MONTHS, WEEKDAYS, daySpend, weekdaySpend } from './sample';

const SAMPLE_WEIGHTS = Object.fromEntries(SAMPLE_SPEND.map((s) => [s.categoryId, s.amount]));

function Notice({ testID, title, body }: { testID: string; title: string; body: string }) {
  return (
    <View testID={testID} className="items-start gap-2 pt-4">
      <Text className="font-tight-extrabold text-[22px] leading-[29px] text-ink">{title}</Text>
      <Text className="font-inter text-body leading-6 text-muted">{body}</Text>
    </View>
  );
}

export function InsightsScreen() {
  const router = useRouter();
  const today = useToday();
  const { period, month, selectMonth } = usePeriod();

  const openCalendar = () => router.push('/sheets/calendar');
  const label = period.kind === 'day' ? shortDate(period.iso) : month.label;

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

      <View testID="insightsWhereItWent" className="px-5 pt-9">
        {period.kind === 'month' ? (
          <MonthContent
            spend={allocate(month.spent, SAMPLE_WEIGHTS)}
            categories={Object.keys(SAMPLE_WEIGHTS).length}
          />
        ) : (
          <DayContent
            iso={period.iso}
            state={dayState(period.iso, today)}
            onWholeMonth={() => selectMonth(month.id)}
          />
        )}
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

function MonthContent({
  spend,
  categories,
}: {
  spend: ReturnType<typeof allocate>;
  categories: number;
}) {
  return (
    <>
      <View className="pb-4">
        <SectionHeader title="Where it went" link={`${categories} categories`} />
      </View>
      <ShareBar spend={spend} />
      <ShareLegend spend={spend} />
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
  const { total, spend } = daySpend(iso);
  const name = weekdayName(iso);
  const typical = WEEKDAYS.find((d) => d.label === weekdayLabel(iso));

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
          <View className="pt-6">
            <SectionHeader
              title={`An average ${name}`}
              link={typical ? formatGhs(pesewas(typical.cedis * 100)) : ''}
            />
          </View>
          <View className="pt-4">
            <ShareBar spend={weekdaySpend(weekdayLabel(iso))} />
            <ShareLegend spend={weekdaySpend(weekdayLabel(iso))} />
          </View>
        </>
      ) : total === 0 ? (
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
