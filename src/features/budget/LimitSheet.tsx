import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { limitProblem } from '@/domain/budget/plan';
import type { BudgetView } from '@/domain/budget/view';
import { formatPlain, parseAmount, pesewas } from '@/domain/money';
import { useWrite } from '@/features/app';
import { useCategories } from '@/features/categories';
import { removeLimit, setLimit } from '@/ledger/budgets';
import { Button, CategoryChip, DashedChip, Sheet, SheetTitle, TextField, TextLink } from '@/ui';

import { ghs } from './labels';
import { useBudgetView } from './useBudget';

const LABEL = 'font-inter-bold text-[14px] leading-[19px] text-ink';

export function LimitSheet() {
  const { plan, category } = useLocalSearchParams<{ plan?: string; category?: string }>();
  const planId = plan !== undefined && /^\d+$/.test(plan) ? Number(plan) : null;
  const view = useBudgetView(planId);
  if (view === undefined) return <Sheet testID="budgetLimitSheet">{null}</Sheet>;
  if (view === null) {
    return (
      <Sheet testID="budgetLimitSheet">
        <SheetTitle title="We could not find that plan." body="It may have been deleted." />
      </Sheet>
    );
  }
  return <Form view={view} initialCategory={category ?? null} />;
}

function Form({ view, initialCategory }: { view: BudgetView; initialCategory: string | null }) {
  const router = useRouter();
  const categories = useCategories();
  const { run, busy, error, setError } = useWrite();

  const limitOf = (id: string | null) =>
    view.categories.find((c) => c.categoryId === id)?.progress.limit ?? null;

  const [categoryId, setCategoryId] = useState<string | null>(initialCategory);
  const [amountText, setAmountText] = useState(() => {
    const old = limitOf(initialCategory);
    return old === null ? '' : formatPlain(pesewas(old));
  });

  const editing = limitOf(initialCategory) !== null;
  const room = view.unplanned + (limitOf(categoryId) ?? 0);
  const choices = categories.filter((c) => c.id !== 'income');

  const save = async () => {
    const amount = parseAmount(amountText);
    const problem = limitProblem({ categoryId, amount }, room);
    if (problem !== null || categoryId === null || amount === null) {
      setError(problem ?? 'Pick a category.');
      return;
    }
    const saved = await run((db) => setLimit(db, view.plan.id, { categoryId, amount }), ['money']);
    if (!saved) return;
    if (saved.value.ok) router.back();
    else setError(saved.value.message);
  };

  const remove = async () => {
    if (initialCategory === null) return;
    const done = await run((db) => removeLimit(db, view.plan.id, initialCategory), ['money']);
    if (done) router.back();
  };

  return (
    <Sheet testID="budgetLimitSheet">
      <SheetTitle
        title={editing ? 'Change the limit' : 'Set a limit'}
        body={`${ghs(room)} of the plan is still unplanned.`}
      />

      <View className="gap-2">
        <Text className={LABEL}>Which category?</Text>
        <View className="flex-row flex-wrap gap-2">
          {choices.map((c) => (
            <CategoryChip
              key={c.id}
              testID={`budgetLimitCategory-${c.id}`}
              label={c.name}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => {
                setCategoryId(c.id);
                setError(null);
              }}
            />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className={LABEL}>Limit (GHS)</Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <TextField
              testID="budgetLimitAmount"
              value={amountText}
              onChangeText={(t) => {
                setAmountText(t);
                setError(null);
              }}
              placeholder="200"
              keyboardType="decimal-pad"
            />
          </View>
          <DashedChip
            testID="budgetLimitRestBtn"
            label="All that's left"
            onPress={() => {
              setAmountText(formatPlain(pesewas(room)));
              setError(null);
            }}
          />
        </View>
      </View>

      {error ? (
        <Text testID="budgetLimitError" className="font-inter text-caption text-warn">
          {error}
        </Text>
      ) : null}
      <Button
        testID="budgetLimitSaveBtn"
        label={editing ? 'Save changes' : 'Set the limit'}
        disabled={busy}
        onPress={() => void save()}
      />
      {editing ? (
        <View className="items-center">
          <TextLink
            testID="budgetLimitRemoveLink"
            label="Remove this limit"
            onPress={() => void remove()}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
