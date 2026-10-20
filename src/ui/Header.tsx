import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Large screen title with an optional trailing control. */
export function ScreenTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-2">
      <Text className="font-tight-extrabold text-[34px] leading-10 tracking-[-0.03em] text-ink">
        {title}
      </Text>
      {trailing}
    </View>
  );
}
