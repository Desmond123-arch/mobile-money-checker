import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BackButton, Hint, Screen } from '@/ui';

import { UNREAD_MESSAGES } from './sample';

function Action({ label }: { label: string }) {
  return (
    <Pressable accessibilityRole="button">
      <Text className="font-inter-semibold text-[14px] leading-[18px] text-ink underline">
        {label}
      </Text>
    </Pressable>
  );
}

export function UnreadMessagesScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View className="px-5 pt-2">
        <BackButton onPress={() => router.back()} />
      </View>
      <View className="gap-[10px] px-5 pt-6">
        <Text className="font-tight-extrabold text-[34px] leading-[38px] tracking-[-0.03em] text-ink">
          Messages we couldn’t read
        </Text>
        <Text className="font-inter text-body leading-6 text-muted">
          These came from MobileMoney, but in a format we don’t know yet. They are not in your
          totals. Nothing here leaves your phone.
        </Text>
      </View>
      <View className="px-5 pt-7">
        {UNREAD_MESSAGES.map((m, i) => (
          <View
            key={m.id}
            className={`gap-[10px] border-t border-hairline py-[18px] ${i === UNREAD_MESSAGES.length - 1 ? 'border-b' : ''}`}
          >
            <View className="flex-row justify-between">
              <Text className="font-inter-bold text-caption text-ink">{m.when}</Text>
              <Text className="font-inter text-caption text-muted">{m.hint}</Text>
            </View>
            <Text className="font-inter text-[15px] leading-[22px] text-ink">{m.body}</Text>
            <View className="flex-row gap-5">
              <Action label="Copy text" />
              <Action label={m.action} />
            </View>
          </View>
        ))}
      </View>
      <View className="mx-5 mt-7">
        <Hint title="Why this happens">
          MTN sometimes changes how a message is worded. Copy the text and share it with whoever
          builds this app, and the next update will read it.
        </Hint>
      </View>
    </Screen>
  );
}
