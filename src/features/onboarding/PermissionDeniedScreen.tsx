import { useRouter } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { useDb } from '@/features/app';
import { Button, FixedScreen, TextLink } from '@/ui';

import { Headline, IconTile, Lede, RuledList } from './components/Parts';
import { recordNotNow } from './recordNotNow';

const STEPS = [
  'Tap "Open phone settings" below',
  'Choose Permissions, then SMS',
  'Select Allow, then come back here',
];

export function PermissionDeniedScreen() {
  const router = useRouter();
  const db = useDb();
  const keepLooking = async () => {
    await recordNotNow(db).catch(() => undefined);
    router.replace('/');
  };
  return (
    <FixedScreen testID="permissionDeniedScreen">
      <View className="flex-1 justify-between px-5 pb-1 pt-6">
        <View className="gap-5">
          <IconTile icon="messageOff" tone="warn" />
          <Headline>SMS access is off.</Headline>
          <Lede>
            Without it we can’t see your MoMo payments, so there’s nothing to show yet. You can turn
            it on in your phone’s settings. It takes about ten seconds.
          </Lede>
          <View className="pt-2">
            <RuledList
              items={STEPS}
              lead={(i) => (
                <View className="size-7 items-center justify-center rounded-[14px] bg-ink">
                  <Text className="font-tight-extrabold text-[14px] leading-[19px] text-ground">
                    {i + 1}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
        <View className="gap-4">
          <Button
            testID="openPhoneSettingsBtn"
            label="Open phone settings"
            onPress={() => void Linking.openSettings()}
          />
          <TextLink
            testID="keepLookingLink"
            label="Keep looking around without it"
            onPress={() => void keepLooking()}
          />
        </View>
      </View>
    </FixedScreen>
  );
}
