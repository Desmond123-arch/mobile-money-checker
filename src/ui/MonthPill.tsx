import { Pressable, Text } from 'react-native';

import { Icon } from './Icon';

export function MonthPill({
  label,
  tone = 'dark',
  testID,
  onPress,
}: {
  label: string;
  tone?: 'dark' | 'light';
  testID?: string;
  onPress?: (() => void) | undefined;
}) {
  const light = tone === 'light';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Month: ${label}`}
      onPress={onPress}
      className={`flex-row items-center gap-[6px] rounded-full py-2 pl-[14px] pr-3 ${light ? 'bg-hairline' : 'bg-white/[0.12]'}`}
    >
      <Text
        className={`font-inter-semibold text-[14px] leading-[18px] ${light ? 'text-ink' : 'text-ground'}`}
      >
        {label}
      </Text>
      <Icon name="chevronDown" size={16} color={light ? '#14110F' : '#FFFFFF'} strokeWidth={1.75} />
    </Pressable>
  );
}
