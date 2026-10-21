import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getMeta } from '@/data/meta';
import { useDb } from '@/features/app';
import { useCategories } from '@/features/categories';
import { useKeywordCounts } from '@/features/categories/useCategoryWords';
import { Icon, Screen, ScreenTitle, TAB_BAR_CLEARANCE, Toggle, hardShadow } from '@/ui';

import { importRowSubtitle } from './importRowSubtitle';
import { NameList } from './components/NameList';
import { Row } from './components/Row';
import { useNameLists, useUnreadMessages } from './useSettingsData';

const NAME_LISTED = ['family', 'friends'];
const wordsLabel = (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`;

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
  const db = useDb();
  const categories = useCategories();
  const names = useNameLists();
  const unread = useUnreadMessages();
  const counts = useKeywordCounts() ?? {};
  // Categories with words, the two that use names, and every one the user made come first.
  const isListed = (id: string) =>
    NAME_LISTED.includes(id) || (counts[id] ?? 0) > 0 || /^\d+$/.test(id);
  const listed = categories.filter((c) => isListed(c.id));
  const hidden = categories.filter((c) => !isListed(c.id));
  const asideOf = (id: string) =>
    NAME_LISTED.includes(id) ? 'uses names' : wordsLabel(counts[id] ?? 0);
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () =>
        (await getMeta(db, 'last_import_at')) ?? (await getMeta(db, 'first_import_at')))()
        .then((value) => live && setLastImportAt(value))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [db]),
  );

  return (
    <Screen testID="settingsScreen" bottomPad={TAB_BAR_CLEARANCE}>
      <ScreenTitle title="Settings" />

      <View className="px-5 pt-7">
        <Heading>Categories</Heading>
        <Text className="pb-2 pt-1 font-inter text-[14px] leading-5 text-muted">
          Open one to add the words that file a payment under it.
        </Text>
        {listed.map((c) => (
          <Row
            key={c.id}
            testID={`categoryRow-${c.id}`}
            swatch={c.color}
            title={c.name}
            aside={asideOf(c.id)}
            onPress={() => router.push(`/category/${c.id}`)}
          />
        ))}
        {showAll
          ? hidden.map((c) => (
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
        {hidden.length > 0 ? (
          <Row
            testID="settingsMoreCategoriesRow"
            title={showAll ? 'Show fewer' : `${hidden.length} more without words`}
            chevron={false}
            last
            trailing={
              <Icon name={showAll ? 'chevronDown' : 'chevronRight'} size={16} strokeWidth={1.75} />
            }
            onPress={() => setShowAll(!showAll)}
          />
        ) : null}
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
        <NameList kind="family" idPrefix="family" names={names?.family ?? []} tint="#FBEBC4" />
        <Text className="pt-2 font-inter-bold text-[14px] leading-[19px] text-ink">Friends</Text>
        <NameList kind="friend" idPrefix="friend" names={names?.friend ?? []} tint="#D9E8FA" />
      </View>

      <View className="px-5 pt-10">
        <View className="pb-2">
          <Heading>More</Heading>
        </View>
        <Row
          testID="settingsImportBackupRow"
          title="Import a backup file"
          subtitle={importRowSubtitle(lastImportAt)}
          onPress={() => router.push('/sheets/import-steps')}
        />
        <Row
          testID="settingsUnreadRow"
          title="Messages we couldn't read"
          subtitle={
            unread === undefined || unread.length === 0
              ? 'None to review'
              : `${unread.length} ${unread.length === 1 ? 'message' : 'messages'}`
          }
          onPress={() => router.push('/unread-messages')}
        />
        <Row
          testID="settingsLockRow"
          title="Lock the app"
          subtitle="Not built yet. Fingerprint or PIN to open"
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
