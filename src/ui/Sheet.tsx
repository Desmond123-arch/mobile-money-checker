import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Sheet({ children, testID }: { children: ReactNode; testID?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} className="flex-1 justify-end bg-black/50">
      <Pressable
        testID="sheetScrim"
        accessibilityLabel="Close"
        className="flex-1"
        onPress={() => router.back()}
      />
      <View className="max-h-[88%] rounded-t-sheet border-t-hard border-ink bg-ground">
        <View className="items-center pb-1 pt-3">
          <View className="h-[5px] w-11 rounded-[3px] bg-[#CFCFCF]" />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 20,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function SheetTitle({ title, body }: { title: string; body?: string }) {
  return (
    <View className="gap-[6px]">
      <Text className="font-tight-extrabold text-[28px] leading-8 tracking-[-0.02em] text-ink">
        {title}
      </Text>
      {body ? (
        <Text className="font-inter text-[15px] leading-[22px] text-muted">{body}</Text>
      ) : null}
    </View>
  );
}
