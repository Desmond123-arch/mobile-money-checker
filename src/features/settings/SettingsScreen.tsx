import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SEED_CATEGORIES } from '@/domain/category/seed';
import { Icon, Screen, ScreenTitle, TAB_BAR_CLEARANCE, Toggle, hardShadow } from '@/ui';

import { NameList } from './components/NameList';
import { Row } from './components/Row';
import { CATEGORY_WORD_COUNTS, FAMILY_NAMES, FRIEND_NAMES, UNREAD_MESSAGES } from './sample';

const LISTED = SEED_CATEGORIES.filter((c) => c.id in CATEGORY_WORD_COUNTS);
const HIDDEN = SEED_CATEGORIES.filter((c) => !(c.id in CATEGORY_WORD_COUNTS));

function Heading({ children }: { children: string }) {
  return (
    <Text className="font-tight-extrabold text-[22px] leading-[29px] tracking-[-0.01em] text-ink">
      {children}
    </Text>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
        {showAll
          ? HIDDEN.map((c) => (
              <Row
                key={c.id}
                testID={`categoryRow-${c.id}`}
                swatch={c.color}
                title={c.name}
                aside="no words yet"
                onPress={() => router.push(`/category/${c.id}`)}
              />
            ))
          : null}
        <Row
          testID="settingsMoreCategoriesRow"
          title={showAll ? 'Show fewer' : `Health, Education and ${HIDDEN.length - 2} more`}
          chevron={false}
          last
          trailing={
            <Icon name={showAll ? 'chevronDown' : 'chevronRight'} size={16} strokeWidth={1.75} />
          }
          onPress={() => setShowAll(!showAll)}
        />
        <Pressable
          testID="settingsNewCategoryBtn"
          accessibilityRole="button"
          onPress={() => router.push('/sheets/new-category')}
          className="mt-5 flex-row items-center justify-center gap-2 rounded-[14px] border-hard border-ink bg-ground p-[14px]"
          style={hardShadow()}
        >
          <Icon name="plusLarge" size={20} strokeWidth={2.2} />
          <Text className="font-tight-extrabold text-body leading-[21px] text-ink">
            New category
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 px-5 pt-10">
        <Heading>People</Heading>
        <Text className="font-inter text-[14px] leading-5 text-muted">
          When a note has one of these names, the payment is filed under it.
        </Text>
        <Text className="pt-1 font-inter-bold text-[14px] leading-[19px] text-ink">Family</Text>
        <NameList idPrefix="family" initial={FAMILY_NAMES} tint="#FBEBC4" />
        <Text className="pt-2 font-inter-bold text-[14px] leading-[19px] text-ink">Friends</Text>
        <NameList idPrefix="friend" initial={FRIEND_NAMES} tint="#D9E8FA" />
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
          onPress={() => router.push('/privacy')}
        />
      </View>
    </Screen>
  );
}
