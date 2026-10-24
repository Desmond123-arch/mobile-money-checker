import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { hardShadow, Icon, type IconName } from '@/ui';

export function IconTile({ icon, tone }: { icon: IconName; tone: 'signal' | 'warn' }) {
  const warn = tone === 'warn';
  return (
    <View
      className={`size-24 items-center justify-center rounded-3xl border-hard border-ink ${warn ? 'bg-ground' : 'bg-signal'}`}
      style={hardShadow(warn ? '#B3261E' : '#14110F')}
    >
      <Icon name={icon} size={48} color={warn ? '#B3261E' : '#14110F'} strokeWidth={3} />
    </View>
  );
}

export function Headline({ children }: { children: string }) {
  return (
    <Text className="pt-3 font-tight-extrabold text-[44px] leading-[58px] tracking-[-0.03em] text-ink">
      {children}
    </Text>
  );
}

export function Lede({ children }: { children: string }) {
  return <Text className="font-inter text-[17px] leading-[26px] text-muted">{children}</Text>;
}

export function RuledList({
  items,
  lead,
}: {
  items: readonly string[];
  lead: (index: number) => ReactNode;
}) {
  return (
    <View>
      {items.map((text, i) => (
        <View key={text} className="flex-row items-start gap-[14px] py-[14px]">
          {lead(i)}
          <Text className="flex-1 font-inter text-body leading-6 text-ink">{text}</Text>
        </View>
      ))}
    </View>
  );
}
