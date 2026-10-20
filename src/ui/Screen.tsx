import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Room under tab screens so content scrolls clear of the floating tab bar. */
export const TAB_BAR_CLEARANCE = 108;

interface ScreenProps {
  children: ReactNode;
  /** Pad the top by the status bar. Off when a dark hero draws behind it. */
  safeTop?: boolean;
  bottomPad?: number;
  testID?: string;
}

export function Screen({ children, safeTop = true, bottomPad = 32, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      className="flex-1 bg-ground"
      contentContainerStyle={{
        paddingTop: safeTop ? insets.top : 0,
        paddingBottom: bottomPad + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** A fixed (non-scrolling) screen for onboarding: content grows, actions pin to the bottom. */
export function FixedScreen({ children, testID }: { children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      className="flex-1 bg-ground"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {children}
    </View>
  );
}
