import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatGhs } from '@/domain/money';
import { useWrite } from '@/features/app';
import { categoryById, useCategories } from '@/features/categories';
import { editTransaction } from '@/ledger/transactionEdit';
import { Button, CategoryChip, Hint, Icon, Sheet, SheetTitle, TextField } from '@/ui';

import { useNoteTarget, type NoteTarget } from './useNoteTarget';

export function AddNoteSheet() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const target = useNoteTarget(id);

  if (target === undefined) return <Sheet testID="addNoteSheet">{null}</Sheet>;
  if (target === null) {
    return (
      <Sheet testID="addNoteSheet">
        <SheetTitle title="All caught up." body="Every payment this month has a note." />
        <Button testID="addNoteDoneBtn" label="Done" onPress={() => router.back()} />
      </Sheet>
    );
  }
  return <NoteForm key={target.id} target={target} />;
}

function NoteForm({ target }: { target: NoteTarget }) {
  const router = useRouter();
  const categories = useCategories();
  const { run, busy, error } = useWrite();
  const initialCategory = target.categoryId ?? 'other';
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [picking, setPicking] = useState(false);
  const filedUnder = categoryById(categoryId);
  const text = note.trim();
  const changed = text !== '' || categoryId !== initialCategory;

  const save = async () => {
    const saved = await run(
      (db) =>
        editTransaction(db, Number(target.id), {
          ...(text === '' ? {} : { note: text }),
          ...(categoryId === initialCategory ? {} : { categoryId }),
        }),
      ['money'],
    );
    if (saved) router.back();
  };

  return (
    <Sheet testID="addNoteSheet">
      <SheetTitle
        title="What did you buy?"
        body={`${formatGhs(target.amount)} to ${target.counterparty}, ${target.when.toLowerCase()}. One or two words is enough.`}
      />
      <TextField
        testID="addNoteInput"
        autoFocus
        value={note}
        onChangeText={setNote}
        placeholder="soap and tissue"
      />
      <View className="gap-3">
        <View className="flex-row items-center gap-[10px]">
          <Text className="font-inter text-[14px] leading-[19px] text-muted">Filed under</Text>
          <Pressable
            testID="addNoteCategoryBtn"
            accessibilityRole="button"
            accessibilityLabel={`Filed under ${filedUnder?.name ?? 'nothing'}. Tap to change`}
            onPress={() => setPicking(!picking)}
            className="flex-row items-center gap-2 rounded-full border-hard border-ink bg-ground px-3 py-[6px]"
          >
            <View
              className="size-[10px] rounded-[3px]"
              style={{ backgroundColor: filedUnder?.color }}
            />
            <Text className="font-inter-semibold text-[14px] leading-[19px] text-ink">
              {filedUnder?.name}
            </Text>
            <Icon
              name={picking ? 'close' : 'chevronDown'}
              size={picking ? 12 : 14}
              strokeWidth={2}
            />
          </Pressable>
          <Text className="font-inter text-caption text-muted">
            {picking ? 'pick one' : 'tap to change'}
          </Text>
        </View>
        {picking ? (
          <View testID="addNoteCategoryList" className="flex-row flex-wrap gap-2">
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                testID={`addNoteCategory-${c.id}`}
                label={c.name}
                color={c.color}
                selected={c.id === categoryId}
                onPress={() => {
                  setCategoryId(c.id);
                  setPicking(false);
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text testID="addNoteError" className="font-inter text-caption text-warn">
          {error}
        </Text>
      ) : null}
      <Button
        testID="addNoteSaveBtn"
        label="Save note"
        disabled={!changed || busy}
        onPress={() => void save()}
      />
      <Hint title="Tip">
        Next time, type the note in MoMo when you pay. It shows up in the message and we file it
        automatically.
      </Hint>
    </Sheet>
  );
}
