import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, FixedScreen, Icon, TextLink } from '@/ui';

import { Headline, IconTile, Lede, RuledList } from './components/Parts';

const PROMISES = [
  'We only read messages from MobileMoney. Nothing else.',
  'Everything stays on this phone. Nothing is uploaded.',
  'Login codes are never saved, even though they arrive from the same sender.',
];

export function PermissionScreen() {
  const router = useRouter();
  return (
    <FixedScreen testID="permissionScreen">
      <View className="flex-1 justify-between px-5 pb-1 pt-6">
        <View className="gap-5">
          <IconTile icon="message" tone="signal" />
          <Headline>Let us read your MoMo messages.</Headline>
          <Lede>
            Every payment already sends you an SMS. We turn those into a clear picture of where your
            money goes. No typing.
          </Lede>
          <View className="pt-3">
            <RuledList
              items={PROMISES}
              lead={() => (
                <View className="mt-[2px]">
                  <Icon name="check" size={22} strokeWidth={2} />
                </View>
              )}
            />
          </View>
        </View>
        <View className="gap-4">
          <Button
            testID="allowSmsBtn"
            label="Allow SMS access"
            variant="ink"
            onPress={() => router.replace('/importing')}
          />
          <TextLink
            testID="notNowLink"
            label="Not now"
            onPress={() => router.replace('/permission-denied')}
          />
        </View>
      </View>
    </FixedScreen>
  );
}
