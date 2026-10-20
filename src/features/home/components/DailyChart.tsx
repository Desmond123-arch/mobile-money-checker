import { Text, View } from 'react-native';

import type { Pesewas } from '@/domain/money';

const MAX_HEIGHT = 96;
const MIN_HEIGHT = 4;

interface Props {
  daily: readonly Pesewas[];
  today: number;
  peakLabel: string | null;
}

export function DailyChart({ daily, today, peakLabel }: Props) {
  const max = Math.max(...daily, 0);
  const peakDay = max > 0 ? daily.indexOf(max as Pesewas) + 1 : 0;

  return (
    <View testID="dailyChart" className="gap-[10px] px-5 pt-7">
      <View className="h-24 flex-row items-end justify-between">
        {daily.map((amount, i) => {
          const day = i + 1;
          const height =
            max === 0 ? MIN_HEIGHT : Math.max(MIN_HEIGHT, Math.round((amount / max) * MAX_HEIGHT));
          const color =
            day === peakDay
              ? '#F5B800'
              : day === today
                ? '#FFFFFF'
                : day > today
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.32)';
          return (
            <View
              key={day}
              className="w-[7px] rounded-b-[1px] rounded-t-[3px]"
              style={{ height, backgroundColor: color }}
            />
          );
        })}
      </View>
      <View className="h-[18px] flex-row items-center justify-between">
        <Text className="font-inter text-caption text-white/70">1</Text>
        <Text className="font-inter text-caption text-white/70">10</Text>
        <Text className="font-inter-semibold text-caption text-ground">Today</Text>
        <Text className="font-inter text-caption text-white/70">{daily.length}</Text>
      </View>
      {peakLabel ? (
        <View className="flex-row items-center gap-2">
          <View className="size-[10px] rounded-[2px] bg-signal" />
          <Text className="font-inter text-caption text-white/90">Biggest day: {peakLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}
