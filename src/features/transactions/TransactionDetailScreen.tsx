import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatGhs } from '@/domain/money';
import type { TransactionDetail } from '@/domain/transaction/transaction';
import {
  Amount,
  BackButton,
  Button,
  CategoryChip,
  DashedChip,
  Icon,
  Screen,
  SubHeading,
  TextField,
  Toggle,
} from '@/ui';

import { useWrite } from '@/features/app';
import { categoryIcon, categoryById, useCategories } from '@/features/categories';
import { editTransaction } from '@/ledger/transactionEdit';

import { useTransactionDetail } from './useTransactions';

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between border-t border-hairline py-3">
      <Text className="font-inter text-body leading-[21px] text-muted">{label}</Text>
      <Text className="font-tight-semibold text-body tabular-nums leading-[21px] text-ink">
        {value}
      </Text>
    </View>
  );
}

export function TransactionDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const tx = useTransactionDetail(id);

  if (tx === undefined) return <Screen testID="detailLoading">{null}</Screen>;
  if (tx === null) return <DetailNotFound />;
  return <DetailBody key={tx.id} tx={tx} />;
}

function DetailNotFound() {
  const router = useRouter();
  return (
    <Screen testID="detailNotFound">
      <View className="px-5 pt-2">
        <BackButton onPress={() => router.back()} />
      </View>
      <View className="items-start gap-2 px-5 pt-8">
        <Text className="font-tight-extrabold text-[22px] leading-[29px] text-ink">
          We could not find that payment.
        </Text>
        <Text className="font-inter text-body leading-6 text-muted">
          It may have been removed. Go back and pick another.
        </Text>
      </View>
    </Screen>
  );
}

function DetailBody({ tx }: { tx: TransactionDetail }) {
  const router = useRouter();
  const categories = useCategories();
  const { run, busy, error } = useWrite();
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [note, setNote] = useState(tx.note ?? '');
  const [alwaysTag, setAlwaysTag] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const category = categoryById(categoryId);

  const initialNote = tx.note ?? '';
  const noteChanged = note.trim() !== initialNote;
  const categoryChanged = categoryId !== tx.categoryId;
  const chips = showAllCategories
    ? categories
    : categories.filter((c, i) => i < 5 || c.id === categoryId);

  // Only what changed is written, so an untouched category keeps following the categoriser.
  const save = async () => {
    if (!noteChanged && !categoryChanged) {
      router.back();
      return;
    }
    const saved = await run(
      (db) =>
        editTransaction(db, Number(tx.id), {
          ...(noteChanged ? { note } : {}),
          ...(categoryChanged && categoryId !== null ? { categoryId, alwaysTag } : {}),
        }),
      ['money'],
    );
    if (saved) router.back();
  };

  return (
    <Screen testID="transactionDetailScreen">
      <View className="flex-row items-center justify-between px-5 pt-2">
        <BackButton onPress={() => router.back()} />
        <Text className="font-inter-semibold text-[14px] leading-[19px] text-muted">
          {tx.occurredAtLabel}
        </Text>
      </View>

      <View className="gap-2 px-5 pt-7">
        <View className="flex-row items-center gap-3">
          <View
            className="size-11 items-center justify-center rounded-[22px]"
            style={{ backgroundColor: category?.tint ?? '#EDEDED' }}
          >
            <Icon name={categoryIcon(categoryId)} size={22} strokeWidth={1.8} />
          </View>
          <Text className="flex-1 font-inter-semibold text-[18px] leading-[24px] text-ink">
            {tx.counterparty}
          </Text>
        </View>
        <Amount testID="detailAmount" amount={tx.amount} sign={tx.direction === 'in' ? '+' : '−'} />
        <Text className="font-inter text-[14px] leading-5 text-muted">{tx.kindLabel}</Text>
      </View>

      <View className="px-5 pt-7">
        <BreakdownRow label="Amount" value={formatGhs(tx.amount)} />
        {tx.balanceAfter !== null ? (
          <BreakdownRow label="Balance after" value={formatGhs(tx.balanceAfter)} />
        ) : null}
      </View>

      <View className="gap-[10px] px-5 pt-8">
        <SubHeading
          title="What was it for?"
          aside={
            tx.noteSource === 'sms'
              ? 'From the SMS'
              : tx.noteSource === 'user'
                ? 'Entered by you'
                : ''
          }
        />
        <TextField
          testID="detailNoteInput"
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
        />
      </View>

      <View className="gap-3 px-5 pt-8">
        <SubHeading title="Category" aside="Picked from your note" />
        <View className="flex-row flex-wrap gap-2">
          {chips.map((c) => (
            <CategoryChip
              key={c.id}
              testID={`detailCategory-${c.id}`}
              label={c.name}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
          <DashedChip
            testID="detailAllCategoriesBtn"
            label={showAllCategories ? 'Fewer' : `All ${categories.length}`}
            onPress={() => setShowAllCategories(!showAllCategories)}
          />
        </View>
        {tx.manual ? null : (
          <View className="flex-row items-center gap-3 pt-4">
            <Toggle
              testID="detailAlwaysTagToggle"
              label="Always tag this recipient"
              value={alwaysTag}
              onChange={setAlwaysTag}
            />
            <Text className="flex-1 font-inter text-[15px] leading-[22px] text-ink">
              Always tag {tx.counterparty} as {category?.name ?? 'this category'}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        testID="detailOriginalMessageToggle"
        accessibilityRole="button"
        onPress={() => setShowOriginal((v) => !v)}
        className="mx-5 mt-8 flex-row items-center justify-between border-y border-hairline py-4"
      >
        <Text className="font-inter-semibold text-body leading-[21px] text-ink">
          Original message
        </Text>
        <Icon name="chevronDownLarge" size={20} strokeWidth={2} />
      </Pressable>
      {showOriginal ? (
        <Text
          testID="detailOriginalMessage"
          className="mx-5 pt-3 font-inter text-[14px] leading-5 text-muted"
        >
          {tx.originalMessage ?? 'The original message is not kept in this app.'}
        </Text>
      ) : null}

      <View className="px-5 pb-2 pt-7">
        {error ? (
          <Text testID="detailError" className="pb-3 font-inter text-caption text-warn">
            {error}
          </Text>
        ) : null}
        <Button
          testID="detailSaveBtn"
          label="Save changes"
          disabled={busy}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}
