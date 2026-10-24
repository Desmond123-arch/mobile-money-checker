import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useDb, useRequestSms } from '@/features/app';
import { Button, FixedScreen, Icon, TextLink } from '@/ui';

import { Headline, IconTile, Lede, RuledList } from './components/Parts';
import { recordNotNow } from './recordNotNow';

const PROMISES = [
  'We only read messages from MobileMoney. Nothing else.',
  'Everything stays on this phone. Nothing is uploaded.',
  'Login codes are never saved, even though they arrive from the same sender.',
];

export function PermissionScreen() {
  const router = useRouter();
  const db = useDb();
  const request = useRequestSms();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const notNow = async () => {
    await recordNotNow(db).catch(() => undefined);
    router.replace('/');
  };

  const allow = async () => {
    setBusy(true);
    setUnavailable(false);
    try {
      const status = await request();
      if (status === null) setUnavailable(true);
      else if (status === 'blocked')
        router.replace({ pathname: '/permission-denied', params: { state: 'blocked' } });
      else if (status !== 'granted') router.replace('/permission-denied');
    } finally {
      setBusy(false);
    }
  };

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
          {unavailable ? (
            <Text testID="allowSmsUnavailableNote" className="font-inter text-caption text-warn">
              This build of the app cannot read messages. Import a backup file instead.
            </Text>
          ) : null}
          <Button
            testID="allowSmsBtn"
            label="Allow SMS access"
            variant="ink"
            disabled={busy}
            onPress={() => void allow()}
          />
          <Button
            testID="importBackupBtn"
            label="Import a backup file"
            variant="outline"
            onPress={() => router.push('/sheets/import-steps')}
          />
          <TextLink testID="permissionNotNowBtn" label="Not now" onPress={() => void notNow()} />
        </View>
      </View>
    </FixedScreen>
  );
}
