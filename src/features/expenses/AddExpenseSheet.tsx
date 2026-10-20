import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SEED_CATEGORIES } from '@/domain/category/seed';
import { parseAmount } from '@/domain/money';
import { Button, CategoryChip, FilterPill, Sheet, SheetTitle, TextField } from '@/ui';

import { useExpenses, type ExpenseDay } from './ExpensesProvider';

const CHOICES = SEED_CATEGORIES.filter((c) => c.id !== 'income');

export function AddExpenseSheet() {
  const router = useRouter();
  const { addExpense } = useExpenses();
  const [amountText, setAmountText] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('other');
  const [day, setDay] = useState<ExpenseDay>('today');

  const amount = parseAmount(amountText);
  const valid = amount !== null && amount > 0 && name.trim() !== '';

  const save = () => {
    if (!valid) return;
    addExpense({ name: name.trim(), amount, categoryId, day });
    router.back();
  };

  return (
    <Sheet testID="addExpenseSheet">
      <SheetTitle
        title="Add an expense"
        body="For cash, or anything MoMo did not send a message for."
      />
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">Amount (GHS)</Text>
        <TextField
          testID="addExpenseAmountInput"
          autoFocus
          value={amountText}
          onChangeText={setAmountText}
          placeholder="12.50"
          keyboardType="decimal-pad"
        />
      </View>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
          What was it for?
        </Text>
        <TextField
          testID="addExpenseNameInput"
          value={name}
          onChangeText={setName}
          placeholder="Kenkey and fish"
        />
      </View>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">Category</Text>
        <View className="flex-row flex-wrap gap-2">
          {CHOICES.map((c) => (
            <CategoryChip
              key={c.id}
              testID={`addExpenseCategory-${c.id}`}
              label={c.name}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">When</Text>
        <View className="flex-row gap-2">
          <FilterPill
            testID="addExpenseDayToday"
            label="Today"
            active={day === 'today'}
            onPress={() => setDay('today')}
          />
          <FilterPill
            testID="addExpenseDayYesterday"
            label="Yesterday"
            active={day === 'yesterday'}
            onPress={() => setDay('yesterday')}
          />
        </View>
      </View>
      <Button testID="addExpenseSaveBtn" label="Add expense" disabled={!valid} onPress={save} />
    </Sheet>
  );
}
