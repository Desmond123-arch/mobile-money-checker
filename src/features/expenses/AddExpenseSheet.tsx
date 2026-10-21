import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { parseAmount } from '@/domain/money';
import { useWrite } from '@/features/app';
import { useCategories } from '@/features/categories';
import { addManualExpense } from '@/ledger/manualExpense';
import { Button, CategoryChip, FilterPill, Sheet, SheetTitle, TextField } from '@/ui';

type ExpenseDay = 'today' | 'yesterday';

const DAY_MS = 86_400_000;

export function AddExpenseSheet() {
  const router = useRouter();
  const { sourceMessageId } = useLocalSearchParams<{ sourceMessageId?: string }>();
  const linked = sourceMessageId === undefined ? undefined : Number(sourceMessageId);
  const choices = useCategories().filter((c) => c.id !== 'income');
  const { run, busy, error } = useWrite();
  const [amountText, setAmountText] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('other');
  const [day, setDay] = useState<ExpenseDay>('today');

  const amount = parseAmount(amountText);
  const valid = amount !== null && amount > 0 && name.trim() !== '';

  const save = async () => {
    if (!valid) return;
    const now = Date.now();
    const saved = await run(
      (db) =>
        addManualExpense(
          db,
          {
            name,
            amount,
            categoryId,
            occurredAt: day === 'today' ? now : now - DAY_MS,
            ...(linked === undefined ? {} : { sourceMessageId: linked }),
          },
          now,
        ),
      linked === undefined ? ['money'] : ['money', 'settings'],
    );
    if (saved) router.back();
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
          {choices.map((c) => (
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
      {linked === undefined ? (
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
      ) : (
        <Text testID="addExpenseLinkedNote" className="font-inter text-caption text-muted">
          Dated like the message you are adding.
        </Text>
      )}
      {error ? (
        <Text testID="addExpenseError" className="font-inter text-caption text-warn">
          {error}
        </Text>
      ) : null}
      <Button
        testID="addExpenseSaveBtn"
        label="Add expense"
        disabled={!valid || busy}
        onPress={() => void save()}
      />
    </Sheet>
  );
}
