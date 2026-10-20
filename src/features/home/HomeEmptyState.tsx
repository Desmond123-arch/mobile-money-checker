import { Text, View } from 'react-native';

import type { MonthSummary } from '@/domain/summary/month';
import { Button, Screen, TAB_BAR_CLEARANCE } from '@/ui';

import { HeroSummary } from './components/HeroSummary';

export function HomeEmptyState({ month }: { month: MonthSummary }) {
  return (
    <Screen testID="homeEmptyState" safeTop={false} bottomPad={TAB_BAR_CLEARANCE}>
      <HeroSummary monthLabel={month.label} spent={month.spent}>
        <View className="mx-5 mt-7 h-16 flex-row items-end justify-between">
          {Array.from({ length: month.daysInMonth }, (_, i) => (
            <View key={i} className="h-1 w-[7px] rounded-[2px] bg-white/[0.12]" />
          ))}
        </View>
      </HeroSummary>
      <View className="items-start gap-3 px-5 pt-10">
        <Text className="font-tight-extrabold text-[28px] leading-8 tracking-[-0.02em] text-ink">
          Nothing here yet.
        </Text>
        <Text className="font-inter text-body leading-6 text-muted">
          Make a MoMo payment and it shows up here the next time you open the app. Already paid
          someone this month? Check for new messages.
        </Text>
        <View className="mt-3">
          <Button
            testID="checkMessagesBtn"
            label="Check for new messages"
            size="md"
            variant="signal"
            block={false}
          />
        </View>
      </View>
    </Screen>
  );
}
