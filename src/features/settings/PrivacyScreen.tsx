import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { BackButton, Hint, Screen } from '@/ui';

const SECTIONS = [
  {
    id: 'read',
    title: 'What we read',
    points: [
      'Only text messages from MobileMoney, the sender MTN uses for your payments.',
      'Login codes arrive from the same sender. We skip them and never save them.',
      'If you allow SMS access, we ask once, and you can turn it off in your phone’s settings any time. You can import a backup file instead.',
    ],
  },
  {
    id: 'keep',
    title: 'What we keep',
    points: [
      'The amount, fee and tax, balance, who you paid and when, for each payment.',
      'The notes and categories you choose, and the words and names you add.',
      'We do not copy the message text. If you import a backup file, we read it once, keep only the payments, and delete our copy of the file.',
    ],
  },
  {
    id: 'never',
    title: 'What never happens',
    points: [
      'Nothing is uploaded. There is no account, no server and no analytics.',
      'The app does not ask for internet access, so it cannot send anything out.',
      'Nothing in the app connects to a server or sends your data anywhere.',
      'Deleting the app deletes everything it stored.',
    ],
  },
] as const;

export function PrivacyScreen() {
  const router = useRouter();
  return (
    <Screen testID="privacyScreen">
      <View className="px-5 pt-2">
        <BackButton onPress={() => router.back()} />
      </View>
      <View className="gap-[10px] px-5 pt-6">
        <Text className="font-tight-extrabold text-[34px] leading-[44px] tracking-[-0.03em] text-ink">
          Everything stays on this phone.
        </Text>
        <Text className="font-inter text-body leading-6 text-muted">
          Here is exactly what the app reads, what it keeps, and what it will never do.
        </Text>
      </View>
      {SECTIONS.map((section) => (
        <View key={section.id} testID={`privacy-${section.id}`} className="px-5 pt-8">
          <Text className="pb-2 font-tight-extrabold text-[22px] leading-[29px] tracking-[-0.01em] text-ink">
            {section.title}
          </Text>
          {section.points.map((point) => (
            <View key={point} className="py-[14px]">
              <Text className="font-inter text-body leading-6 text-ink">{point}</Text>
            </View>
          ))}
        </View>
      ))}
      <View className="mx-5 mt-8">
        <Hint title="Questions?">
          Everything on this page is how the app works today. If that ever changes, this page
          changes first.
        </Hint>
      </View>
    </Screen>
  );
}
