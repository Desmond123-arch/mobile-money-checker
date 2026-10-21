import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { occurredAtLabel } from '@/domain/transaction/label';
import { useWrite } from '@/features/app';
import { useToday } from '@/features/period';
import { dismissMessage } from '@/ledger/unread';
import { BackButton, Hint, Screen } from '@/ui';

import { useUnreadMessages } from './useSettingsData';

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
  const today = useToday();
  const messages = useUnreadMessages();
  const { run, error } = useWrite();

  const list = messages ?? [];

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
        {list.map((m, i) => (
          <View
            key={m.id}
            testID={`unreadMessage-${m.id}`}
            className={`gap-[10px] border-t border-hairline py-[18px] ${i === list.length - 1 ? 'border-b' : ''}`}
          >
            <View className="flex-row justify-between">
              <Text className="font-inter-bold text-caption text-ink">
                {occurredAtLabel(m.receivedAt, false, today)}
              </Text>
              <Text className="font-inter text-caption text-muted">
                {m.status === 'error' ? 'We hit a problem' : 'Format not known yet'}
              </Text>
            </View>
            <Text className="font-inter text-[15px] leading-[22px] text-muted">
              The text is not kept in this app. Find it in your messages app at this time.
            </Text>
            <View className="flex-row gap-5">
              <Action
                testID={`unreadAdd-${m.id}`}
                label="Add by hand"
                onPress={() => router.push(`/sheets/add-expense?sourceMessageId=${m.id}`)}
              />
              <Action
                testID={`unreadIgnore-${m.id}`}
                label="Ignore"
                danger
                onPress={() => void run((db) => dismissMessage(db, m.id), ['settings'])}
              />
            </View>
          </View>
        ))}
        {error ? (
          <Text testID="unreadError" className="pt-3 font-inter text-caption text-warn">
            {error}
          </Text>
        ) : null}
        {messages !== undefined && list.length === 0 ? (
          <View testID="unreadEmpty" className="items-start gap-2 pt-2">
            <Text className="font-tight-extrabold text-[22px] leading-[29px] text-ink">
              All clear.
            </Text>
            <Text className="font-inter text-body leading-6 text-muted">
              Nothing to review. Messages in a format we don’t know show up here once the app reads
              your inbox. Importing a backup file never lists them.
            </Text>
          </View>
        ) : null}
      </View>
      <View className="mx-5 mt-7">
        <Hint title="Why this happens">
          MTN sometimes changes how a message is worded. Add the payment by hand and it counts in
          your totals, or ignore the message.
        </Hint>
      </View>
    </Screen>
  );
}
