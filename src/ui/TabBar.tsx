import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
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
          return (
            <Animated.View
              key={route.key}
              layout={LinearTransition.duration(240)}
              className={focused ? 'rounded-[28px] bg-signal' : 'rounded-[28px]'}
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                className={
                  focused
                    ? 'h-[52px] flex-row items-center gap-2 px-5'
                    : 'size-[52px] items-center justify-center'
                }
              >
                <Icon
                  name={tab.icon}
                  size={focused ? 22 : 24}
                  color={focused ? '#14110F' : '#FFFFFF'}
                />
                {focused ? (
                  <Animated.Text
                    entering={FadeIn.duration(200).delay(60)}
                    exiting={FadeOut.duration(80)}
                    className="font-inter-bold text-[14px] leading-[18px] text-ink"
                  >
                    {tab.label}
                  </Animated.Text>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
