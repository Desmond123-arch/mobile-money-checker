import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { hardShadow, Icon, type IconName } from '@/ui';

/** The big icon tile at the top of the permission screens. */
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
    <Text className="pt-3 font-tight-extrabold text-[44px] leading-[46px] tracking-[-0.03em] text-ink">
      {children}
    </Text>
  );
}

export function Lede({ children }: { children: string }) {
  return <Text className="font-inter text-[17px] leading-[26px] text-muted">{children}</Text>;
}

/** Hairline-ruled list: `lead` is the check or step number. */
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
        <View
          key={text}
          className={`flex-row items-start gap-[14px] border-t border-hairline py-[14px] ${i === items.length - 1 ? 'border-b' : ''}`}
        >
          {lead(i)}
          <Text className="flex-1 font-inter text-body leading-6 text-ink">{text}</Text>
        </View>
      ))}
    </View>
  );
}
