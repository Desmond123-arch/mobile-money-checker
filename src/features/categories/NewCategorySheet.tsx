import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_SWATCHES } from '@/domain/category/seed';
import { Button, DashedChip, Sheet, TextField, WordChip } from '@/ui';

export function NewCategorySheet() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_SWATCHES[0]);

  return (
    <Sheet testID="newCategorySheet">
      <Text className="font-tight-extrabold text-[28px] leading-8 tracking-[-0.02em] text-ink">
        New category
      </Text>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[18px] text-ink">Name</Text>
        <TextField
          testID="newCategoryNameInput"
          value={name}
          onChangeText={setName}
          placeholder="Church"
        />
      </View>
      <View className="gap-[10px]">
        <Text className="font-inter-bold text-[14px] leading-[18px] text-ink">Colour</Text>
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
          <Text className="font-inter-bold text-[14px] leading-[18px] text-ink">
            Words that file payments here
          </Text>
          <Text className="font-inter text-caption text-muted">Optional</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <WordChip testID="newCategoryWord-tithe" label="tithe" tint="#E6E1FA" />
          <WordChip testID="newCategoryWord-offering" label="offering" tint="#E6E1FA" />
          <DashedChip testID="newCategoryAddWordBtn" label="Add word" icon />
        </View>
      </View>
      <Button testID="createCategoryBtn" label="Create category" onPress={() => router.back()} />
    </Sheet>
  );
}
