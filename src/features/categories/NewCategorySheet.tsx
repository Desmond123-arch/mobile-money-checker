import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CATEGORY_SWATCHES } from '@/domain/category/seed';
import { normaliseWord, tintOf } from '@/domain/category/word';
import { useWrite } from '@/features/app';
import { createCategory } from '@/ledger/categories';
import { Button, DashedChip, Sheet, TextField, WordChip } from '@/ui';

import { problemMessage } from './messages';

export function NewCategorySheet() {
  const router = useRouter();
  const { run, busy, error } = useWrite();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_SWATCHES[0]);
  const [words, setWords] = useState<readonly string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const commitWord = () => {
    const word = normaliseWord(draft);
    if (word !== '' && !words.includes(word)) setWords([...words, word]);
    setDraft('');
    setAdding(false);
  };

  const create = async () => {
    setProblem(null);
    const saved = await run(
      (db) => createCategory(db, { name, color, words }),
      ['money', 'settings'],
    );
    if (!saved) return;
    if (saved.value.ok) router.back();
    else setProblem(problemMessage(saved.value, { name: name.trim() }));
  };

  return (
    <Sheet testID="newCategorySheet">
      <Text className="font-tight-extrabold text-[28px] leading-[37px] tracking-[-0.02em] text-ink">
        New category
      </Text>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">Name</Text>
        <TextField
          testID="newCategoryNameInput"
          value={name}
          onChangeText={setName}
          placeholder="Church"
        />
      </View>
      <View className="gap-[10px]">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">Colour</Text>
        <View className="flex-row gap-3">
          {CATEGORY_SWATCHES.map((c) => (
            <Pressable
              key={c}
              testID={`newCategorySwatch-${c.slice(1)}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: c === color }}
              onPress={() => setColor(c)}
              className={`size-9 rounded-[10px] ${c === color ? 'border-[3px] border-ink' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
            Words that file payments here
          </Text>
          <Text className="font-inter text-caption text-muted">Optional</Text>
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          {words.map((w) => (
            <WordChip
              key={w}
              testID={`newCategoryWord-${w}`}
              label={w}
              tint={tintOf(color)}
              onRemove={() => setWords(words.filter((x) => x !== w))}
            />
          ))}
          {adding ? (
            <TextInput
              testID="newCategoryWordInput"
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={commitWord}
              onBlur={commitWord}
              placeholder="Word"
              placeholderTextColor="#444444"
              returnKeyType="done"
              autoCapitalize="none"
              className="min-w-[110px] rounded-full border-hard border-dashed border-ink bg-ground px-[14px] py-[6px] font-inter-semibold text-[14px] text-ink"
            />
          ) : (
            <DashedChip
              testID="newCategoryAddWordBtn"
              label="Add word"
              icon
              onPress={() => setAdding(true)}
            />
          )}
        </View>
      </View>
      {problem || error ? (
        <Text testID="newCategoryError" className="font-inter text-caption text-warn">
          {problem ?? error}
        </Text>
      ) : null}
      <Button
        testID="createCategoryBtn"
        label="Create category"
        disabled={name.trim() === '' || busy}
        onPress={() => void create()}
      />
    </Sheet>
  );
}
