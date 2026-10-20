import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatGhs, type Pesewas } from '@/domain/money';
import { Amount, Icon, MonthPill } from '@/ui';

interface HeroProps {
  monthLabel: string;
  spent: Pesewas;
  delta?: { label: string; compare: string };
  /** Chart, totals row, anything below the headline number. */
  children?: ReactNode;
}

/** The dark hero: month pill, the month's spend, and whatever the screen puts under it. */
export function HeroSummary({ monthLabel, spent, delta, children }: HeroProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="rounded-b-[32px] bg-ink pb-6" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-5">
        <MonthPill label={monthLabel} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          className="size-10 items-center justify-center rounded-[20px] bg-white/[0.12]"
        >
          <Icon name="filter" size={20} color="#FFFFFF" strokeWidth={1.75} />
        </Pressable>
      </View>
      <View className="gap-2 px-5 pt-7">
        <Text className="font-inter-medium text-[14px] leading-[18px] text-white/70">
          Spent so far this month
        </Text>
        <Amount amount={spent} tone="inverse" />
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
  lane,
}: {
  label: string;
  value: string;
  tone?: 'ground' | 'in';
  lane?: boolean;
}) {
  return (
    <View className={`gap-[2px] ${lane ? 'w-[72px]' : 'flex-1'}`}>
      <Text className="font-inter text-caption text-white/70">{label}</Text>
      <Text
        className={`font-tight-bold text-[18px] tabular-nums leading-[22px] ${tone === 'in' ? 'text-[#7FE0A8]' : 'text-ground'}`}
      >
        {value}
      </Text>
    </View>
  );
}

export function TotalsRow({
  moneyIn,
  feesAndTax,
  payments,
}: {
  moneyIn: Pesewas;
  feesAndTax: Pesewas;
  payments: number;
}) {
  return (
    <View className="mx-5 mt-6 flex-row border-t border-white/[0.14] pt-5">
      <Stat label="Money in" value={`+${formatGhs(moneyIn)}`} tone="in" />
      <Stat label="Fees and tax" value={formatGhs(feesAndTax)} />
      <Stat label="Payments" value={String(payments)} lane />
    </View>
  );
}
