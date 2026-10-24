import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatGhs, type Pesewas } from '@/domain/money';
import { Amount, Icon, MonthPill } from '@/ui';

interface HeroProps {
  monthLabel: string;
  spent: Pesewas;
  delta?: { label: string; compare: string };
  children?: ReactNode;
  onMonthPress?: (() => void) | undefined;
  onFilterPress?: (() => void) | undefined;
  onAddPress?: (() => void) | undefined;
}

export function HeroSummary({
  monthLabel,
  spent,
  delta,
  children,
  onMonthPress,
  onFilterPress,
  onAddPress,
}: HeroProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="rounded-b-[32px] bg-ink pb-6" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-5">
        <MonthPill testID="homeMonthPill" label={monthLabel} onPress={onMonthPress} />
        <View className="flex-row items-center gap-2">
          <Pressable
            testID="homeAddExpenseBtn"
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel="Add an expense"
            className="size-10 items-center justify-center rounded-[20px] bg-signal"
          >
            <Icon name="plusLarge" size={20} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            testID="homeFilterBtn"
            onPress={onFilterPress}
            accessibilityRole="button"
            accessibilityLabel="Filter"
            className="size-10 items-center justify-center rounded-[20px] bg-white/[0.12]"
          >
            <Icon name="filter" size={20} color="#FFFFFF" strokeWidth={1.75} />
          </Pressable>
        </View>
      </View>
      <View className="gap-2 px-5 pt-7">
        <Text className="font-inter-medium text-[14px] leading-[19px] text-white/70">
          Spent so far this month
        </Text>
        <Amount testID="homeSpentAmount" amount={spent} tone="inverse" />
        {delta ? (
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-signal py-1 pl-2 pr-[10px]">
              <Icon name="arrowDown" size={14} strokeWidth={2} />
              <Text className="font-inter-bold text-caption text-ink">{delta.label}</Text>
            </View>
            <Text className="font-inter text-caption text-white/70">{delta.compare}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Stat({
  label,
  value,
  tone = 'ground',
  divider = false,
  testID,
}: {
  label: string;
  value: string;
  tone?: 'ground' | 'in';
  divider?: boolean;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      className={`w-1/3 items-center gap-[2px] ${divider ? 'border-l border-white/[0.14]' : ''}`}
    >
      <Text className="font-inter text-caption text-white/70">{label}</Text>
      <Text
        numberOfLines={1}
        className={`font-tight-bold text-[16px] tabular-nums leading-[24px] ${tone === 'in' ? 'text-[#7FE0A8]' : 'text-ground'}`}
      >
        {value}
      </Text>
    </View>
  );
}

export function TotalsRow({
  moneyIn,
  payments,
  average,
}: {
  moneyIn: Pesewas;
  payments: number;
  average: Pesewas;
}) {
  return (
    <View className="mx-5 mt-6 flex-row border-t border-white/[0.14] pt-5">
      <Stat testID="homeMoneyIn" label="Money in" value={`+${formatGhs(moneyIn)}`} tone="in" />
      <Stat testID="homePayments" label="Payments" value={String(payments)} divider />
      <Stat testID="homeDailyAverage" label="A day" value={formatGhs(average)} divider />
    </View>
  );
}
