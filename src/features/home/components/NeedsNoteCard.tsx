import { Pressable, Text, View } from 'react-native';

import { Icon, hardShadow } from '@/ui';

export function NeedsNoteCard({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      testID="needsNoteCard"
      accessibilityRole="button"
      onPress={onPress}
      className="mx-5 mt-5 flex-row items-center gap-[14px] rounded-2xl border-hard border-ink bg-signal p-4"
      style={hardShadow()}
    >
      <View className="size-11 items-center justify-center rounded-[22px] bg-ink">
        <Icon name="pencil" size={22} color="#F5B800" strokeWidth={1.9} />
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text className="font-tight-extrabold text-[18px] leading-[22px] tracking-[-0.01em] text-ink">
          What were these for?
        </Text>
        <Text className="font-inter text-[14px] leading-5 text-ink">
          {count} {count === 1 ? 'payment needs' : 'payments need'} a note
        </Text>
      </View>
      <Icon name="chevronRightLarge" size={20} strokeWidth={2} />
    </Pressable>
  );
}
