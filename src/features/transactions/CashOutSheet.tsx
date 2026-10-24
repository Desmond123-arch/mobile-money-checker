import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatGhs } from '@/domain/money';
import { useWrite } from '@/features/app';
import { useCategories } from '@/features/categories';
import { editTransaction } from '@/ledger/transactionEdit';
import { Button, CategoryChip, DashedChip, Sheet, SheetTitle, TextField, TextLink } from '@/ui';

import { useNoteTarget, type NoteTarget } from './useNoteTarget';

const COMMON = ['rent', 'food', 'transport', 'family', 'shopping', 'health', 'education'];
const ASK_AGAIN_AFTER_MS = 86_400_000;

export function CashOutSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const target = useNoteTarget(id ?? '');
  if (!target) return <Sheet testID="cashOutSheet">{null}</Sheet>;
  return <CashOutForm key={target.id} target={target} />;
}

function CashOutForm({ target }: { target: NoteTarget }) {
  const router = useRouter();
  const categories = useCategories();
  const { run, busy, error } = useWrite();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);

  const pickable = categories.filter((c) => c.id !== 'income' && c.id !== 'cash');
  const shown = showAll ? pickable : pickable.filter((c) => COMMON.includes(c.id));
  const text = note.trim();

  const save = async () => {
    if (categoryId === null) return;
    const saved = await run(
      (db) =>
        editTransaction(db, Number(target.id), {
          categoryId,
          ...(text === '' ? {} : { note: text }),
        }),
      ['money'],
    );
    if (saved) router.back();
  };

  const askLater = async () => {
    const now = Date.now();
    const saved = await run(
      (db) =>
        editTransaction(
          db,
          Number(target.id),
          { promptSnoozedUntil: now + ASK_AGAIN_AFTER_MS },
          now,
        ),
      ['money'],
    );
    if (saved) router.back();
  };

  return (
    <Sheet testID="cashOutSheet">
      <SheetTitle
        title="What was this cash for?"
        body={`You took out ${formatGhs(target.amount)} at ${target.counterparty}, ${target.when.toLowerCase()}. MoMo doesn't say what happens next, so tell us.`}
      />
      <View className="flex-row flex-wrap gap-2">
        {shown.map((c) => (
          <CategoryChip
            key={c.id}
            testID={`cashOutCategory-${c.id}`}
            size="lg"
            label={c.name}
            color={c.color}
            selected={c.id === categoryId}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
        <DashedChip
          testID="cashOutMoreBtn"
          label={showAll ? 'Fewer' : 'More'}
          onPress={() => setShowAll(!showAll)}
        />
      </View>
      <View className="gap-2">
        <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
          A note, if you like
        </Text>
        <TextField
          testID="cashOutNoteInput"
          value={note}
          onChangeText={setNote}
          placeholder="October rent, part one"
        />
      </View>
      {error ? (
        <Text testID="cashOutError" className="font-inter text-caption text-warn">
          {error}
        </Text>
      ) : null}
      <Button
        testID="cashOutSaveBtn"
        label="Save"
        disabled={categoryId === null || busy}
        onPress={() => void save()}
      />
      <View className="items-center">
        <TextLink
          testID="cashOutSplitLink"
          label="Split it up"
          onPress={() => router.replace(`/sheets/cash-allocations?id=${target.id}`)}
        />
        <TextLink
          testID="cashOutAskLaterLink"
          label="Ask me later"
          onPress={() => void askLater()}
        />
      </View>
    </Sheet>
  );
}
