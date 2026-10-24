import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SEED_KEYWORDS } from '@/domain/categorise/seed';
import { useWrite } from '@/features/app';
import { addKeyword, deleteCategory, removeKeyword } from '@/ledger/categories';
import {
  BackButton,
  Button,
  DashedChip,
  Screen,
  SubHeading,
  SuggestionChip,
  TextField,
  WordChip,
} from '@/ui';

import { categoryById, useCategories } from './lookup';
import { problemMessage } from './messages';
import { useCategoryImpact, useCategoryKeywords } from './useCategoryWords';

const COLLAPSED_WORDS = 12;
const SUGGESTION_COUNT = 4;

export function EditCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  useCategories();
  const category = categoryById(id ?? null);
  const words = useCategoryKeywords(id ?? '');
  const impact = useCategoryImpact(id ?? '');
  const { run, busy, error } = useWrite({ overlap: true });
  const [word, setWord] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!category) return null;

  const add = async (text: string) => {
    setProblem(null);
    const saved = await run(
      (db) => addKeyword(db, category.id, text),
      (res) => (res.ok && res.changed > 0 ? ['money', 'settings'] : ['settings']),
    );
    if (!saved) return;
    if (saved.value.ok) setWord('');
    else setProblem(problemMessage(saved.value, { word: text.trim() }));
  };

  const remove = (value: string) => {
    setProblem(null);
    void run(
      (db) => removeKeyword(db, category.id, value),
      (changed) => (changed > 0 ? ['money', 'settings'] : ['settings']),
    );
  };

  const confirmDelete = () => {
    if (!impact) return;
    const parts = [
      `${impact.transactions} ${impact.transactions === 1 ? 'payment moves' : 'payments move'} to Other.`,
      ...(impact.allocations > 0
        ? [
            `${impact.allocations} cash ${impact.allocations === 1 ? 'entry moves' : 'entries move'} to Other.`,
          ]
        : []),
      `${impact.keywords} ${impact.keywords === 1 ? 'word is' : 'words are'} removed.`,
      `${impact.rules} ${impact.rules === 1 ? 'recipient rule is' : 'recipient rules are'} removed.`,
      ...(impact.budgets > 0
        ? [
            `${impact.budgets} ${impact.budgets === 1 ? 'budget limit is' : 'budget limits are'} removed.`,
          ]
        : []),
      'Your notes stay.',
    ];
    Alert.alert(`Delete ${category.name}?`, parts.join('\n'), [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void run((db) => deleteCategory(db, category.id), ['money', 'settings']).then(
            (done) => done && router.back(),
          );
        },
      },
    ]);
  };

  const list = words ?? [];
  const shown = showAll ? list : list.slice(0, COLLAPSED_WORDS);
  const have = new Set(list.map((w) => w.value));
  const removedSeed = (SEED_KEYWORDS.find((s) => s.systemKey === category.id)?.words ?? [])
    .filter((w) => !have.has(w))
    .slice(0, SUGGESTION_COUNT);

  return (
    <Screen testID="editCategoryScreen">
      <View className="flex-row items-center justify-between px-5 pt-2">
        <BackButton onPress={() => router.back()} />
        <Text className="font-inter-semibold text-[14px] leading-[19px] text-muted">Category</Text>
      </View>

      <View className="flex-row items-center gap-3 px-5 pt-6">
        <View className="size-5 rounded-[6px]" style={{ backgroundColor: category.color }} />
        <Text className="font-tight-extrabold text-[40px] leading-[52px] tracking-[-0.03em] text-ink">
          {category.name}
        </Text>
      </View>
      <Text className="px-5 pt-2 font-inter text-[15px] leading-[22px] text-muted">
        A payment goes here when its note has one of these words. Small typos still match, so
        “wayer” finds water.
      </Text>

      <View className="gap-[10px] px-5 pt-7">
        <Text className="font-tight-extrabold text-section tracking-[-0.01em] text-ink">
          Add a word
        </Text>
        <View className="flex-row gap-[10px]">
          <View className="flex-1">
            <TextField
              testID="editCategoryWordInput"
              value={word}
              onChangeText={setWord}
              placeholder="fried rice"
              onSubmitEditing={() => void add(word)}
              returnKeyType="done"
            />
          </View>
          <View className="justify-center">
            <Button
              testID="editCategoryAddWordBtn"
              label="Add"
              size="md"
              block={false}
              disabled={busy}
              onPress={() => void add(word)}
            />
          </View>
        </View>
        {problem || error ? (
          <Text
            testID="editCategoryError"
            className="font-inter text-caption leading-[18px] text-warn"
          >
            {problem ?? error}
          </Text>
        ) : (
          <Text className="pt-1 font-inter text-caption leading-[18px] text-muted">
            Two words are fine. Try “fried rice” or “kenkey and fish”.
          </Text>
        )}
      </View>

      <View className="gap-3 px-5 pt-8">
        <SubHeading title="Your words" aside={String(list.length)} />
        <View className="flex-row flex-wrap gap-2">
          {shown.map((w) => (
            <WordChip
              key={w.value}
              testID={`categoryWord-${w.value}`}
              label={w.value}
              tint={category.tint}
              onRemove={() => remove(w.value)}
            />
          ))}
          {list.length > COLLAPSED_WORDS ? (
            <DashedChip
              testID="editCategoryShowAllBtn"
              label={showAll ? 'Show fewer' : `Show all ${list.length}`}
              onPress={() => setShowAll(!showAll)}
            />
          ) : null}
        </View>
      </View>

      {removedSeed.length > 0 ? (
        <View className="gap-3 px-5 pt-8">
          <Text className="font-tight-extrabold text-section tracking-[-0.01em] text-ink">
            Words you removed
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {removedSeed.map((s) => (
              <SuggestionChip
                key={s}
                testID={`suggestion-${s}`}
                label={s}
                onPress={() => void add(s)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {impact?.deletable ? (
        <Pressable
          testID="deleteCategoryBtn"
          onPress={confirmDelete}
          accessibilityRole="button"
          className="mx-5 mt-10 items-center p-[14px]"
        >
          <Text className="font-inter-semibold text-[15px] leading-[20px] text-warn">
            Delete this category
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
