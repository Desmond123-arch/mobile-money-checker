import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';

import { Icon, type IconName } from './Icon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  transactions: { label: 'Transactions', icon: 'list' },
  insights: { label: 'Insights', icon: 'pie' },
  settings: { label: 'Settings', icon: 'gear' },
};

/** The floating black bar: the active tab is a yellow pill with a label, the rest are icons. */
export function TabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-4"
      style={{ bottom: Math.max(insets.bottom, 12) + 4 }}
    >
      <View className="flex-row items-center justify-between rounded-[36px] bg-ink p-2">
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return focused ? (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              onPress={onPress}
              className="flex-row items-center gap-2 rounded-[28px] bg-signal px-5 py-[14px]"
            >
              <Icon name={tab.icon} size={22} strokeWidth={2} />
              <Text className="font-inter-bold text-[14px] leading-[18px] text-ink">
                {tab.label}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              onPress={onPress}
              className="size-[52px] items-center justify-center"
            >
              <Icon name={tab.icon} color="#FFFFFF" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
