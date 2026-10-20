import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SEED_CATEGORIES } from '@/domain/category/seed';
import { formatGhs } from '@/domain/money';
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

import { categoryIcon, categoryById } from '@/features/categories';

import { SAMPLE_DETAIL } from './sample';

const VISIBLE_CATEGORIES = SEED_CATEGORIES.slice(0, 5);

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
  const router = useRouter();
  const tx = SAMPLE_DETAIL;
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [note, setNote] = useState(tx.note ?? '');
  const [alwaysTag, setAlwaysTag] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const category = categoryById(categoryId);

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
        <Amount testID="detailAmount" amount={tx.amount} sign="−" />
        <Text className="font-inter text-[14px] leading-5 text-muted">{tx.kindLabel}</Text>
      </View>

      <View className="px-5 pt-7">
        <BreakdownRow label="Amount" value={formatGhs(tx.amount)} />
        <BreakdownRow label="Balance after" value={formatGhs(tx.balanceAfter)} />
      </View>

      <View className="gap-[10px] px-5 pt-8">
        <SubHeading
          title="What was it for?"
          aside={tx.noteSource === 'sms' ? 'From the SMS' : 'Entered by you'}
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
          {VISIBLE_CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              testID={`detailCategory-${c.id}`}
              label={c.name}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
          <DashedChip testID="detailAllCategoriesBtn" label={`All ${SEED_CATEGORIES.length}`} />
        </View>
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
          {tx.originalMessage}
        </Text>
      ) : null}

      <View className="px-5 pb-2 pt-7">
        <Button testID="detailSaveBtn" label="Save changes" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
