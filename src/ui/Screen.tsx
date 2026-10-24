import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomInset } from './useBottomInset';

export { TAB_BAR_CLEARANCE } from './insets';

interface ScreenProps {
  children: ReactNode;
  safeTop?: boolean;
  bottomPad?: number;
  testID?: string;
}

export function Screen({ children, safeTop = true, bottomPad = 32, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-ground">
      <ScrollView
        testID={testID}
        className="flex-1 bg-ground"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: safeTop ? insets.top : 0,
          paddingBottom: bottomPad + bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function FixedScreen({ children, testID }: { children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      testID={testID}
      className="flex-1 bg-ground"
      style={{ paddingTop: insets.top, paddingBottom: bottom }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
