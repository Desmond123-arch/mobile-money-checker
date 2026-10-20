import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SEED_CATEGORIES } from '@/domain/category/seed';
import {
  DashedChip,
  Icon,
  Screen,
  ScreenTitle,
  TAB_BAR_CLEARANCE,
  Toggle,
  WordChip,
  hardShadow,
} from '@/ui';

import { Row } from './components/Row';
import { CATEGORY_WORD_COUNTS, FAMILY_NAMES, FRIEND_NAMES, UNREAD_MESSAGES } from './sample';

const LISTED = SEED_CATEGORIES.filter((c) => c.id in CATEGORY_WORD_COUNTS);

function Heading({ children }: { children: string }) {
  return (
    <Text className="font-tight-extrabold text-[22px] leading-7 tracking-[-0.01em] text-ink">
      {children}
    </Text>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);

  return (
    <Screen testID="settingsScreen" bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle title="Settings" />

      <View className="px-5 pt-7">
        <Heading>Categories</Heading>
        <Text className="pb-2 pt-1 font-inter text-[14px] leading-5 text-muted">
          Open one to add the words that file a payment under it.
        </Text>
        {LISTED.map((c) => (
          <Row
            key={c.id}
            testID={`categoryRow-${c.id}`}
            swatch={c.color}
            title={c.name}
            aside={CATEGORY_WORD_COUNTS[c.id]}
            onPress={() => router.push(`/category/${c.id}`)}
          />
        ))}
        <Row
          title={`Health, Education and ${SEED_CATEGORIES.length - LISTED.length - 2} more`}
          last
        />
        <Pressable
          testID="settingsNewCategoryBtn"
          accessibilityRole="button"
          onPress={() => router.push('/sheets/new-category')}
          className="mt-5 flex-row items-center justify-center gap-2 rounded-[14px] border-hard border-ink bg-ground p-[14px]"
          style={hardShadow()}
        >
          <Icon name="plusLarge" size={20} strokeWidth={2.2} />
          <Text className="font-tight-extrabold text-body leading-5 text-ink">New category</Text>
        </Pressable>
      </View>

      <View className="gap-3 px-5 pt-10">
        <Heading>People</Heading>
        <Text className="font-inter text-[14px] leading-5 text-muted">
          When a note has one of these names, the payment is filed under it.
        </Text>
        <Text className="pt-1 font-inter-bold text-[14px] leading-[18px] text-ink">Family</Text>
        <View className="flex-row flex-wrap gap-2">
          {FAMILY_NAMES.map((n) => (
            <WordChip key={n} testID={`familyName-${n}`} label={n} tint="#FBEBC4" />
          ))}
          <DashedChip testID="addFamilyNameBtn" label="Add name" icon />
        </View>
        <Text className="pt-2 font-inter-bold text-[14px] leading-[18px] text-ink">Friends</Text>
        <View className="flex-row flex-wrap gap-2">
          {FRIEND_NAMES.map((n) => (
            <WordChip key={n} testID={`friendName-${n}`} label={n} tint="#D9E8FA" />
          ))}
          <DashedChip testID="addFriendNameBtn" label="Add name" icon />
        </View>
      </View>

      <View className="px-5 pt-10">
        <View className="pb-2">
          <Heading>More</Heading>
        </View>
        <Row
          testID="settingsUnreadRow"
          title="Messages we couldn't read"
          subtitle={`${UNREAD_MESSAGES.length} messages`}
          onPress={() => router.push('/unread-messages')}
        />
        <Row
          testID="settingsLockRow"
          title="Lock the app"
          subtitle="Fingerprint or PIN to open"
          trailing={
            <Toggle
              testID="settingsLockToggle"
              label="Lock the app"
              value={locked}
              onChange={setLocked}
            />
          }
        />
        <Row
          testID="settingsPrivacyRow"
          title="Privacy"
          subtitle="Everything stays on this phone"
          last
        />
      </View>
    </Screen>
  );
}
