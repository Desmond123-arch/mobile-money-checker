import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SEED_CATEGORIES } from '@/domain/category/seed';
import { categoryById } from '@/features/categories';
import { Button, CategoryChip, Hint, Icon, Sheet, SheetTitle, TextField } from '@/ui';

export function AddNoteSheet() {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('shopping');
  const [picking, setPicking] = useState(false);
  const filedUnder = categoryById(categoryId);

  return (
    <Sheet testID="addNoteSheet">
      <SheetTitle
        title="What did you buy?"
        body="GHS 45.00 to Circle Mart, yesterday. One or two words is enough."
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
            {SEED_CATEGORIES.map((c) => (
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
      <Button testID="addNoteSaveBtn" label="Save note" onPress={() => router.back()} />
      <Hint title="Tip">
        Next time, type the note in MoMo when you pay. It shows up in the message and we file it
        automatically.
      </Hint>
    </Sheet>
  );
}
