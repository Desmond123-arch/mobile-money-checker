import Animated, { LinearTransition } from 'react-native-reanimated';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { hardShadow } from './hardShadow';
import { Icon } from './Icon';

/** Text input with the 2px border and hard shadow. */
export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#444444"
      selectionColor="#14110F"
      className="rounded-chip border-hard border-ink bg-ground px-4 py-[14px] font-inter text-body text-ink"
      style={hardShadow()}
      {...props}
    />
  );
}

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange?: (next: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange?.(!value)}
      className={`h-7 w-12 shrink-0 justify-center rounded-[14px] px-[3px] ${value ? 'bg-ink' : 'bg-[#DADADA]'}`}
    >
      <Animated.View
        layout={LinearTransition.duration(180)}
        className={`size-[22px] rounded-[11px] ${value ? 'self-end bg-signal' : 'self-start bg-ground'}`}
      />
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      className="size-11 items-center justify-center rounded-[22px] border-hard border-ink bg-ground"
      style={hardShadow('#14110F', 2)}
    >
      <Icon name="back" size={20} strokeWidth={2} />
    </Pressable>
  );
}

/** A quiet grey note: tips and "why this happens". */
export function Hint({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-[6px] rounded-chip bg-[#F4F4F4] px-[14px] py-3">
      <Text className="font-inter-bold text-[14px] leading-[18px] text-ink">{title}</Text>
      <Text className="font-inter text-[14px] leading-5 text-muted">{children}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  link,
  onLinkPress,
}: {
  title: string;
  link?: string;
  onLinkPress?: () => void;
}) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className="font-tight-extrabold text-title tracking-[-0.02em] text-ink">{title}</Text>
      {link ? (
        <Pressable accessibilityRole="link" onPress={onLinkPress}>
          <Text className="font-inter-semibold text-[14px] leading-[18px] text-ink underline">
            {link}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small heading used inside a screen: "Category", "What was it for?". */
export function SubHeading({ title, aside }: { title: string; aside?: string }) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className="font-tight-extrabold text-section tracking-[-0.01em] text-ink">{title}</Text>
      {aside ? <Text className="font-inter text-caption text-muted">{aside}</Text> : null}
    </View>
  );
}
