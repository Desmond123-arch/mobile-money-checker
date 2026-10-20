import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SEED_CATEGORIES } from '@/domain/category/seed';
import { Button, CategoryChip, DashedChip, Sheet, SheetTitle, TextField, TextLink } from '@/ui';

const CHOICES = SEED_CATEGORIES.filter((c) =>
  ['rent', 'food', 'transport', 'family', 'shopping', 'health', 'education'].includes(c.id),
);

export function CashOutSheet() {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState('rent');
  const [note, setNote] = useState('');

  return (
    <Sheet>
      <SheetTitle
        title="What was this cash for?"
        body="You took out GHS 200.00 at Inmuel Ventures on Mon 19 Oct. MoMo doesn't say what happens next, so tell us."
      />
      <View className="flex-row flex-wrap gap-2">
        {CHOICES.map((c) => (
          <CategoryChip
            key={c.id}
            size="lg"
            label={c.name}
            color={c.color}
            selected={c.id === categoryId}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
        <DashedChip label="More" />
      </View>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[18px] text-ink">
          A note, if you like
        </Text>
        <TextField value={note} onChangeText={setNote} placeholder="October rent, part one" />
      </View>
      <Button label="Save" onPress={() => router.back()} />
      <View className="items-center">
        <TextLink label="Ask me later" onPress={() => router.back()} />
      </View>
    </Sheet>
  );
}
