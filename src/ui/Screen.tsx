import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_CLEARANCE = 108;

interface ScreenProps {
  children: ReactNode;
  safeTop?: boolean;
  bottomPad?: number;
  testID?: string;
}

export function Screen({ children, safeTop = true, bottomPad = 32, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-ground">
      <ScrollView
        testID={testID}
        className="flex-1 bg-ground"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: safeTop ? insets.top : 0,
          paddingBottom: bottomPad + insets.bottom,
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
  return (
    <KeyboardAvoidingView
      behavior="padding"
      testID={testID}
      className="flex-1 bg-ground"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
