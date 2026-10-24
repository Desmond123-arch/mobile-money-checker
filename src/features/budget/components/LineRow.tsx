import { Pressable, Text, View } from 'react-native';

import type { Progress } from '@/domain/budget/progress';

import { ghs, rowRight } from '../labels';
import { BudgetBar } from './BudgetBar';

interface LineRowProps {
  name: string;
  caption: string;
  progress: Progress;
  tint: string;
  color: string;
  onPress?: () => void;
  testID: string;
}

/** One category line: disc, name, "spent of limit", a thin bar, and left or over in a fixed lane. */
export function LineRow({ name, caption, progress, tint, color, onPress, testID }: LineRowProps) {
  const body = (
    <>
      <View
        className="size-11 shrink-0 items-center justify-center rounded-[22px]"
        style={{ backgroundColor: tint }}
      >
        <View className="size-[14px] rounded-[4px]" style={{ backgroundColor: color }} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text numberOfLines={1} className="font-inter-semibold text-body leading-[22px] text-ink">
          {name}
        </Text>
        <Text numberOfLines={1} className="font-inter text-caption text-muted">
          {caption}
        </Text>
        <BudgetBar
          size="sm"
          fraction={progress.fraction}
          tone={progress.tone}
          accessibilityLabel={`${name}: ${ghs(progress.spent)} of ${ghs(progress.limit)} spent`}
        />
      </View>
      <View className="w-[116px] shrink-0 items-end">
        <Text
          numberOfLines={1}
          className={`font-tight-bold text-body tabular-nums ${progress.over > 0 ? 'text-warn' : 'text-ink'}`}
        >
          {rowRight(progress)}
        </Text>
      </View>
    </>
  );
  const className = 'min-h-11 flex-row items-center gap-3 py-3';
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${rowRight(progress)}. Change the limit`}
      onPress={onPress}
      className={className}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} className={className}>
      {body}
    </View>
  );
}
