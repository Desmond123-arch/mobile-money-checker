import { View } from 'react-native';

import type { Tone } from '@/domain/budget/progress';

const FILL: Record<Tone, string> = {
  fine: 'bg-ink',
  watch: 'bg-signal',
  over: 'bg-warn',
};

interface BudgetBarProps {
  /** 0 to 1. */
  fraction: number;
  tone: Tone;
  /** 0 to 1: a tick showing where an even pace would be. */
  marker?: number;
  size?: 'lg' | 'sm';
  accessibilityLabel: string;
  testID?: string;
}

const clamp = (n: number) => Math.min(Math.max(n, 0), 1);

export function BudgetBar({
  fraction,
  tone,
  marker,
  size = 'lg',
  accessibilityLabel,
  testID,
}: BudgetBarProps) {
  const percent = Math.round(clamp(fraction) * 100);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className="justify-center"
    >
      <View className={`w-full rounded-full bg-hairline ${size === 'lg' ? 'h-3' : 'h-[6px]'}`}>
        <View
          className={`h-full rounded-full ${FILL[tone]}`}
          style={{ width: `${clamp(fraction) * 100}%` }}
        />
      </View>
      {marker === undefined ? null : (
        <View
          className="absolute -top-1 h-5 w-[2px] bg-ink"
          style={{ left: `${clamp(marker) * 100}%` }}
        />
      )}
    </View>
  );
}
