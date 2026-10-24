import { Text, View } from 'react-native';

import { Icon } from '@/ui';
import type { Comparison } from '@/domain/summary/compare';

export function Stat({ testID, label, value }: { testID: string; label: string; value: string }) {
  return (
    <View testID={testID} className="flex-1 gap-1 rounded-chip border-hard border-ink p-3">
      <Text className="font-inter text-caption text-muted">{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="font-tight-extrabold text-[18px] leading-6 text-ink"
      >
        {value}
      </Text>
    </View>
  );
}

/** "12% more than 2025" with an arrow that points the way the money moved. */
export function ComparisonLine({ testID, comparison }: { testID: string; comparison: Comparison }) {
  return (
    <View testID={testID} className="flex-row items-center gap-2 pt-2">
      {comparison.direction === 'same' ? null : (
        <View
          testID={`${testID}${comparison.direction === 'up' ? 'Up' : 'Down'}`}
          style={{ transform: [{ rotate: comparison.direction === 'up' ? '180deg' : '0deg' }] }}
        >
          <Icon name="arrowDown" size={14} strokeWidth={2} />
        </View>
      )}
      <Text className="font-inter-semibold text-[14px] leading-5 text-ink">{comparison.text}</Text>
    </View>
  );
}
