import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackButton, Hint, Screen } from '@/ui';

import { UNREAD_MESSAGES } from './sample';

function Action({
  label,
  testID,
  onPress,
  danger = false,
}: {
  label: string;
  testID: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text
        className={`font-inter-semibold text-[14px] leading-[19px] underline ${danger ? 'text-warn' : 'text-ink'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function UnreadMessagesScreen() {
  const router = useRouter();
  const [ignored, setIgnored] = useState<readonly string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const messages = UNREAD_MESSAGES.filter((m) => !ignored.includes(m.id));

  const copy = async (id: string, body: string) => {
    await Clipboard.setStringAsync(body);
    setCopied(id);
  };

  return (
    <Screen testID="unreadMessagesScreen">
      <View className="px-5 pt-2">
        <BackButton onPress={() => router.back()} />
      </View>
      <View className="gap-[10px] px-5 pt-6">
        <Text className="font-tight-extrabold text-[34px] leading-[44px] tracking-[-0.03em] text-ink">
          Messages we couldn’t read
        </Text>
        <Text className="font-inter text-body leading-6 text-muted">
          These came from MobileMoney, but in a format we don’t know yet. They are not in your
          totals. Nothing here leaves your phone.
        </Text>
      </View>
      <View className="px-5 pt-7">
        {messages.map((m, i) => (
          <View
            key={m.id}
            testID={`unreadMessage-${m.id}`}
            className={`gap-[10px] border-t border-hairline py-[18px] ${i === messages.length - 1 ? 'border-b' : ''}`}
          >
            <View className="flex-row justify-between">
              <Text className="font-inter-bold text-caption text-ink">{m.when}</Text>
              <Text className="font-inter text-caption text-muted">{m.hint}</Text>
            </View>
            <Text className="font-inter text-[15px] leading-[22px] text-ink">{m.body}</Text>
            <View className="flex-row gap-5">
              <Action
                testID={`unreadCopy-${m.id}`}
                label={copied === m.id ? 'Copied' : 'Copy text'}
                onPress={() => void copy(m.id, m.body)}
              />
              {m.looksLikePayment ? (
                <Action testID={`unreadAdd-${m.id}`} label="Add by hand" />
              ) : null}
              <Action
                testID={`unreadIgnore-${m.id}`}
                label="Ignore"
                danger
                onPress={() => setIgnored([...ignored, m.id])}
              />
            </View>
          </View>
        ))}
        {messages.length === 0 ? (
          <View testID="unreadEmpty" className="items-start gap-2 pt-2">
            <Text className="font-tight-extrabold text-[22px] leading-[29px] text-ink">
              All clear.
            </Text>
            <Text className="font-inter text-body leading-6 text-muted">
              Nothing left to review. Messages in a format we don’t know will show up here.
            </Text>
          </View>
        ) : null}
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
