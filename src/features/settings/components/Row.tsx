import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Icon } from '@/ui';

interface RowProps {
  title: string;
  subtitle?: string;
  swatch?: string;
  aside?: string | undefined;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Row({
  title,
  subtitle,
  swatch,
  aside,
  trailing,
  chevron = true,
  onPress,
  testID,
}: RowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 py-[14px]"
    >
      {swatch ? (
        <View className="size-3 rounded-[3px]" style={{ backgroundColor: swatch }} />
      ) : null}
      <View className="flex-1 gap-[2px]">
        <Text
          className={`font-inter-medium text-body leading-[21px] ${swatch || subtitle ? 'text-ink' : 'text-muted'}`}
        >
          {title}
        </Text>
        {subtitle ? <Text className="font-inter text-caption text-muted">{subtitle}</Text> : null}
      </View>
      {aside ? (
        <Text className="font-inter text-[14px] leading-[19px] text-muted">{aside}</Text>
      ) : null}
      {trailing}
      {chevron && !trailing ? <Icon name="chevronRight" size={16} strokeWidth={1.75} /> : null}
    </Pressable>
  );
}
