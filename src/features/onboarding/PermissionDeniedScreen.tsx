import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';

import { useDb, useRequestSms, useScan } from '@/features/app';
import { Button, FixedScreen, TextLink } from '@/ui';

import { Headline, IconTile, Lede, RuledList } from './components/Parts';
import { recordNotNow } from './recordNotNow';

const DENIED_STEPS = [
  'Tap "Open phone settings" below',
  'Choose Permissions, then SMS',
  'Select Allow, then come back here',
];

// Android 13+ greys out SMS access for an APK installed from a browser or file manager, and the
// system dialog never shows. The user has to lift that block by hand first.
const BLOCKED_STEPS = [
  'Tap "Open Settings" below. This opens the App info page',
  'Tap the three dots at the top right, then "Allow restricted settings"',
  'Come back here and tap "Try again", then allow SMS',
];

export function PermissionDeniedScreen() {
  const router = useRouter();
  const db = useDb();
  const scan = useScan();
  const request = useRequestSms();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const blocked = state === 'blocked';
  const [busy, setBusy] = useState(false);
  const [stillOff, setStillOff] = useState(false);

  const keepLooking = async () => {
    await recordNotNow(db).catch(() => undefined);
    router.replace('/');
  };

  const tryAgain = async () => {
    setBusy(true);
    setStillOff(false);
    try {
      const status = await request();
      if (status === 'blocked') router.setParams({ state: 'blocked' });
      else if (status !== 'granted') setStillOff(true);
    } finally {
      setBusy(false);
    }
  };

  // Coming back from the phone's settings with SMS now allowed should not need another tap.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void scan.refresh().then(async (status) => {
        if (status === 'granted') router.replace(await scan.afterGrant());
      });
    });
    return () => sub.remove();
  }, [router, scan]);

  return (
    <FixedScreen testID="permissionDeniedScreen">
      <View className="flex-1 justify-between px-5 pb-1 pt-6">
        <View className="gap-5">
          <IconTile icon="messageOff" tone="warn" />
          <Headline>{blocked ? 'Android is blocking SMS access.' : 'SMS access is off.'}</Headline>
          <Lede>
            {blocked
              ? 'Phones block SMS access for apps installed from a browser or a file manager. It is a safety rule, and you can lift it for this app yourself.'
              : 'Without it we can’t see your MoMo payments, so there’s nothing to show yet. You can turn it on in your phone’s settings. It takes about ten seconds.'}
          </Lede>
          <View className="pt-2">
            <RuledList
              items={blocked ? BLOCKED_STEPS : DENIED_STEPS}
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
          {stillOff ? (
            <Text testID="permissionStillOffNote" className="font-inter text-caption text-warn">
              SMS access is still off.
            </Text>
          ) : null}
          <Button
            testID="permissionTryAgainBtn"
            label="Try again"
            variant="ink"
            disabled={busy}
            onPress={() => void tryAgain()}
          />
          <Button
            testID="openPhoneSettingsBtn"
            label={blocked ? 'Open Settings' : 'Open phone settings'}
            variant="outline"
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
