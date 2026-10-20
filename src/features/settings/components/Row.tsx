import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Icon } from '@/ui';

interface RowProps {
  title: string;
  subtitle?: string;
  /** A swatch on the left (category rows). */
  swatch?: string;
  /** Muted text before the chevron ("64 words"). */
  aside?: string | undefined;
  trailing?: ReactNode;
  chevron?: boolean;
  last?: boolean;
  onPress?: () => void;
}

/** A hairline-separated settings row. Rows own their top border; the last one also closes the list. */
export function Row({
  title,
  subtitle,
  swatch,
  aside,
  trailing,
  chevron = true,
  last = false,
  onPress,
}: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3 border-t border-hairline py-[14px] ${last ? 'border-b' : ''}`}
    >
      {swatch ? (
        <View className="size-3 rounded-[3px]" style={{ backgroundColor: swatch }} />
      ) : null}
      <View className="flex-1 gap-[2px]">
        <Text
          className={`font-inter-medium text-body leading-5 ${swatch || subtitle ? 'text-ink' : 'text-muted'}`}
        >
          {title}
        </Text>
        {subtitle ? <Text className="font-inter text-caption text-muted">{subtitle}</Text> : null}
      </View>
      {aside ? (
        <Text className="font-inter text-[14px] leading-[18px] text-muted">{aside}</Text>
      ) : null}
      {trailing}
      {chevron && !trailing ? <Icon name="chevronRight" size={16} strokeWidth={1.75} /> : null}
    </Pressable>
  );
}
