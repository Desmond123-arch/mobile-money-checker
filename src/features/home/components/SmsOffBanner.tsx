import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useRequestSms, useScan } from '@/features/app';
import { Button, hardShadow } from '@/ui';

/**
 * Shown over stored data when SMS access is not granted: Android 11+ revokes it from unused apps,
 * and a user who imported a backup may never have granted it.
 */
export function SmsOffBanner() {
  const router = useRouter();
  const { permission } = useScan();
  const request = useRequestSms();
  if (permission === null || permission === 'granted') return null;

  const turnOn = async () => {
    const status = await request();
    if (status === 'blocked')
      router.push({ pathname: '/permission-denied', params: { state: 'blocked' } });
    else if (status === 'denied' || status === 'undetermined') router.push('/permission-denied');
  };

  return (
    <View className="px-5 pt-6">
      <View
        testID="smsOffBanner"
        className="gap-3 rounded-[14px] border-hard border-ink bg-ground p-4"
        style={hardShadow('#B3261E')}
      >
        <Text className="font-tight-extrabold text-[18px] leading-[24px] text-ink">
          SMS access is off.
        </Text>
        <Text className="font-inter text-caption text-muted">
          New payments will not appear on their own. What we already saved is still here.
        </Text>
        <Button
          testID="smsOffBannerBtn"
          label={permission === 'blocked' ? 'See how to turn it on' : 'Turn it on'}
          size="md"
          variant="ink"
          block={false}
          onPress={() => void turnOn()}
        />
      </View>
    </View>
  );
}
