import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { categoryById } from '@/features/categories';
import { Button, Hint, Sheet, SheetTitle, TextField } from '@/ui';

export function AddNoteSheet() {
  const router = useRouter();
  const [note, setNote] = useState('');
  const filedUnder = categoryById('shopping');

  return (
    <Sheet>
      <SheetTitle
        title="What did you buy?"
        body="GHS 45.00 to Circle Mart, yesterday. One or two words is enough."
      />
      <TextField autoFocus value={note} onChangeText={setNote} placeholder="soap and tissue" />
      <View className="flex-row items-center gap-[10px]">
        <Text className="font-inter text-[14px] leading-[18px] text-muted">Filed under</Text>
        <Pressable
          accessibilityRole="button"
          className="flex-row items-center gap-2 rounded-full border-hard border-ink bg-ground px-3 py-[6px]"
        >
          <View
            className="size-[10px] rounded-[3px]"
            style={{ backgroundColor: filedUnder?.color }}
          />
          <Text className="font-inter-semibold text-[14px] leading-[18px] text-ink">
            {filedUnder?.name}
          </Text>
        </Pressable>
        <Text className="font-inter text-caption text-muted">tap to change</Text>
      </View>
      <Button label="Save note" onPress={() => router.back()} />
      <Hint title="Tip">
        Next time, type the note in MoMo when you pay. It shows up in the message and we file it
        automatically.
      </Hint>
    </Sheet>
  );
}
