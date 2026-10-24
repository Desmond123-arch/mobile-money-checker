import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useCategories } from '@/features/categories';
import { CategoryChip, Sheet, SheetTitle } from '@/ui';

import { useTransactionFilter } from './filterContext';

export function CategoryFilterSheet() {
  const router = useRouter();
  const { goTo } = useLocalSearchParams<{ goTo?: string }>();
  const { categoryId, setCategoryId } = useTransactionFilter();
  const categories = useCategories();

  const choose = (id: string | null) => {
    setCategoryId(id);
    router.back();
    if (goTo === 'transactions') router.navigate('/transactions');
  };

  return (
    <Sheet testID="categoryFilterSheet">
      <SheetTitle title="Filter by category" body="Show only payments filed under one category." />
      <View className="flex-row flex-wrap gap-2">
        <CategoryChip
          testID="categoryFilter-all"
          size="lg"
          label="All categories"
          color="#14110F"
          selected={categoryId === null}
          onPress={() => choose(null)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            testID={`categoryFilter-${c.id}`}
            size="lg"
            label={c.name}
            color={c.color}
            selected={categoryId === c.id}
            onPress={() => choose(c.id)}
          />
        ))}
      </View>
    </Sheet>
  );
}
