import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useDb, useScan } from '@/features/app';
import { Button, FixedScreen, TextLink } from '@/ui';

import { Headline, IconTile, Lede, RuledList } from './components/Parts';
import { recordNotNow } from './recordNotNow';

const HINTS = [
  'Open your Messages app and check that MobileMoney messages are there.',
  'On Xiaomi, Tecno and Infinix phones, allow "service" or "notification" messages in the Messages app settings. Those phones hide messages from services like MobileMoney until you do.',
  'Or import a backup file instead. It needs no SMS access.',
];

export function NoMessagesScreen() {
  const router = useRouter();
  const db = useDb();
  const scan = useScan();

  const checkAgain = () => {
    void scan.afterGrant();
    router.replace('/importing');
  };

  const keepLooking = async () => {
    await recordNotNow(db).catch(() => undefined);
    router.replace('/');
  };

  return (
    <FixedScreen testID="noMessagesScreen">
      <View className="flex-1 justify-between px-5 pb-1 pt-6">
        <View className="gap-5">
          <IconTile icon="messageOff" tone="warn" />
          <Headline>We can’t see any MobileMoney messages.</Headline>
          <Lede>
            SMS access is on, but the phone shows us no messages from MobileMoney. Some phones hide
            them.
          </Lede>
          <View className="pt-2">
            <RuledList items={HINTS} lead={() => null} />
          </View>
        </View>
        <View className="gap-4">
          <Button
            testID="noMessagesCheckAgainBtn"
            label="Check again"
            variant="ink"
            onPress={checkAgain}
          />
          <Button
            testID="noMessagesImportBtn"
            label="Import a backup file"
            variant="outline"
            onPress={() => router.push('/sheets/import-steps')}
          />
          <TextLink
            testID="noMessagesKeepLookingLink"
            label="Keep looking around without it"
            onPress={() => void keepLooking()}
          />
        </View>
      </View>
    </FixedScreen>
  );
}
