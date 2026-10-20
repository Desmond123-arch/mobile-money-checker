import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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

import { categoryById } from './lookup';

const SAMPLE_WORDS = [
  'jollof',
  'waakye',
  'banku',
  'kenkey',
  'red red',
  'fufu',
  'kelewele',
  'bread',
  'koko',
  'groceries',
];
const SUGGESTIONS = ['hausa koko', 'shawarma', 'sobolo', 'tilapia'];

export function EditCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = categoryById(id ?? null);
  const [word, setWord] = useState('');
  const [words, setWords] = useState(SAMPLE_WORDS);

  const add = (w: string) => {
    const trimmed = w.trim();
    if (trimmed && !words.includes(trimmed)) setWords([trimmed, ...words]);
    setWord('');
  };

  if (!category) return null;

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <BackButton onPress={() => router.back()} />
        <Text className="font-inter-semibold text-[14px] leading-[18px] text-muted">Category</Text>
      </View>

      <View className="flex-row items-center gap-3 px-5 pt-6">
        <View className="size-5 rounded-[6px]" style={{ backgroundColor: category.color }} />
        <Text className="font-tight-extrabold text-[40px] leading-[44px] tracking-[-0.03em] text-ink">
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
              value={word}
              onChangeText={setWord}
              placeholder="fried rice"
              onSubmitEditing={() => add(word)}
              returnKeyType="done"
            />
          </View>
          <View className="justify-center">
            <Button label="Add" size="md" block={false} onPress={() => add(word)} />
          </View>
        </View>
        <Text className="pt-1 font-inter text-caption leading-[18px] text-muted">
          Two words are fine. Try “fried rice” or “kenkey and fish”.
        </Text>
      </View>

      <View className="gap-3 px-5 pt-8">
        <SubHeading title="Your words" aside={String(words.length)} />
        <View className="flex-row flex-wrap gap-2">
          {words.map((w) => (
            <WordChip
              key={w}
              label={w}
              tint={category.tint}
              onRemove={() => setWords(words.filter((x) => x !== w))}
            />
          ))}
          <DashedChip label="Show all 64" />
        </View>
      </View>

      <View className="gap-3 px-5 pt-8">
        <Text className="font-tight-extrabold text-section tracking-[-0.01em] text-ink">
          People often add
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <SuggestionChip key={s} label={s} onPress={() => add(s)} />
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        className="mx-5 mt-10 items-center border-t border-hairline p-[14px]"
      >
        <Text className="font-inter-semibold text-[15px] leading-[18px] text-warn">
          Delete this category
        </Text>
      </Pressable>
    </Screen>
  );
}
