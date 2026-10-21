import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { CashAllocation, CashOutBreakdown } from '@/data/queries';
import { allocationProblem } from '@/domain/cash/allocation';
import { isoDate, shortDate } from '@/domain/calendar/week';
import { formatGhs, formatPlain, parseAmount, pesewas } from '@/domain/money';
import { useWrite } from '@/features/app';
import { categoryById, useCategories } from '@/features/categories';
import { useToday } from '@/features/period';
import { addAllocation, deleteAllocation, updateAllocation } from '@/ledger/cashAllocations';
import {
  Amount,
  Button,
  CategoryChip,
  DashedChip,
  FilterPill,
  Icon,
  Sheet,
  SheetTitle,
  TextField,
  TextLink,
} from '@/ui';

import { DayPicker } from './components/DayPicker';
import { useCashOutBreakdown } from './useCashAllocations';

const DAY_MS = 86_400_000;
const dayStart = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function CashAllocationsSheet() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const breakdown = useCashOutBreakdown(id);
  if (breakdown === undefined) return <Sheet testID="cashAllocSheet">{null}</Sheet>;
  if (breakdown === null) {
    return (
      <Sheet testID="cashAllocSheet">
        <SheetTitle title="We could not find that withdrawal." body="It may have been removed." />
      </Sheet>
    );
  }
  return <Allocations breakdown={breakdown} />;
}

function Allocations({ breakdown }: { breakdown: CashOutBreakdown }) {
  const router = useRouter();
  const categories = useCategories();
  const { run, busy, error, setError } = useWrite();
  const today = useToday();
  const todayIso = isoDate(today);
  const yesterdayIso = isoDate(new Date(today.getTime() - DAY_MS));
  const firstIso = isoDate(new Date(breakdown.occurredAt));

  const [editing, setEditing] = useState<CashAllocation | null>(null);
  const [open, setOpen] = useState(breakdown.allocations.length === 0);
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dayIso, setDayIso] = useState(todayIso);
  const [picking, setPicking] = useState(false);

  const choices = categories.filter((c) => c.id !== 'income' && c.id !== 'cash');
  const room = breakdown.left + (editing?.amount ?? 0);
  const formShown = open || editing !== null;

  const reset = () => {
    setEditing(null);
    setOpen(false);
    setAmountText('');
    setCategoryId(null);
    setNote('');
    setDayIso(todayIso);
    setPicking(false);
    setError(null);
  };

  const edit = (entry: CashAllocation) => {
    setEditing(entry);
    setAmountText(formatPlain(pesewas(entry.amount)));
    setCategoryId(entry.categoryId);
    setNote(entry.note ?? '');
    setDayIso(isoDate(new Date(entry.spentOn)));
    setPicking(false);
    setError(null);
  };

  const save = async () => {
    const input = {
      categoryId: categoryId ?? '',
      amount: parseAmount(amountText) ?? 0,
      note,
      spentOn: dayStart(dayIso),
    };
    const now = Date.now();
    const problem = allocationProblem(
      { categoryId, amount: input.amount, spentOn: input.spentOn },
      { room, cashOutAt: breakdown.occurredAt, now },
    );
    if (problem !== null) {
      setError(problem);
      return;
    }
    const saved = await run(
      (db) =>
        editing === null
          ? addAllocation(db, breakdown.id, input, now)
          : updateAllocation(db, editing.id, input, now),
      ['money'],
    );
    if (!saved) return;
    if (saved.value.ok) reset();
    else setError(saved.value.message);
  };

  const confirmDelete = (entry: CashAllocation) => {
    const name = categoryById(entry.categoryId)?.name ?? 'this entry';
    Alert.alert(
      `Remove ${name}?`,
      `${formatGhs(pesewas(entry.amount))} goes back to what is left.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void run((db) => deleteAllocation(db, entry.id), ['money']).then((done) => {
              if (done && editing?.id === entry.id) reset();
            });
          },
        },
      ],
    );
  };

  const pickDay = (iso: string) => {
    setDayIso(iso);
    setPicking(false);
  };

  return (
    <Sheet testID="cashAllocSheet">
      <SheetTitle
        title="Where did the cash go?"
        body={`You took out ${formatGhs(pesewas(breakdown.amount))} at ${breakdown.counterparty}, ${shortDate(firstIso)}. Add what you spent it on, one by one, any time.`}
      />

      <View className="flex-row items-end justify-between">
        <View className="gap-1">
          <Text className="font-inter-bold text-caption text-muted">Left</Text>
          <Amount testID="cashAllocLeft" amount={pesewas(breakdown.left)} />
        </View>
        <View className="items-end gap-1 pb-2">
          <Text className="font-inter-bold text-caption text-muted">Spent</Text>
          <Text
            testID="cashAllocSpent"
            className="font-tight-bold text-[20px] tabular-nums leading-[26px] text-ink"
          >
            {formatGhs(pesewas(breakdown.allocated))}
          </Text>
        </View>
      </View>

      {breakdown.allocations.length > 0 ? (
        <View testID="cashAllocList">
          {breakdown.allocations.map((entry) => {
            const category = categoryById(entry.categoryId);
            return (
              <View key={entry.id} className="flex-row items-center gap-2">
                <Pressable
                  testID={`cashAllocRow-${entry.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${category?.name ?? 'entry'}`}
                  onPress={() => edit(entry)}
                  className="min-w-0 flex-1 flex-row items-center gap-3 py-3"
                >
                  <View
                    className="size-11 shrink-0 items-center justify-center rounded-[22px]"
                    style={{ backgroundColor: category?.tint ?? '#EDEDED' }}
                  >
                    <View
                      className="size-[14px] rounded-[4px]"
                      style={{ backgroundColor: category?.color ?? '#9A9A9A' }}
                    />
                  </View>
                  <View className="min-w-0 flex-1 gap-[2px]">
                    <Text
                      numberOfLines={1}
                      className="font-inter-semibold text-body leading-[22px] text-ink"
                    >
                      {category?.name ?? 'Other'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="font-inter text-caption leading-[18px] text-muted"
                    >
                      {[entry.note, shortDate(isoDate(new Date(entry.spentOn)))]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text className="shrink-0 font-tight-bold text-body tabular-nums text-ink">
                    {formatPlain(pesewas(entry.amount))}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`cashAllocDelete-${entry.id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Remove"
                  hitSlop={8}
                  onPress={() => confirmDelete(entry)}
                  className="size-9 items-center justify-center"
                >
                  <Icon name="close" size={16} strokeWidth={2} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {formShown ? (
        <View testID="cashAllocForm" className="gap-5">
          <View className="gap-2">
            <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
              {editing === null ? 'Amount (GHS)' : 'Amount (GHS), editing'}
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <TextField
                  testID="cashAllocAmount"
                  value={amountText}
                  onChangeText={(t) => {
                    setAmountText(t);
                    setError(null);
                  }}
                  placeholder="12.50"
                  keyboardType="decimal-pad"
                />
              </View>
              <DashedChip
                testID="cashAllocRestBtn"
                label="The rest"
                onPress={() => {
                  setAmountText(formatPlain(pesewas(room)));
                  setError(null);
                }}
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
              What was it for?
            </Text>
            <View testID="cashAllocCategory" className="flex-row flex-wrap gap-2">
              {choices.map((c) => (
                <CategoryChip
                  key={c.id}
                  testID={`cashAllocCategory-${c.id}`}
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
            <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
              A note, if you like
            </Text>
            <TextField
              testID="cashAllocNote"
              value={note}
              onChangeText={setNote}
              placeholder="Kenkey and fish"
            />
          </View>

          <View className="gap-2">
            <Text className="font-inter-bold text-[14px] leading-[19px] text-ink">
              When did you spend it?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterPill
                testID="cashAllocDayToday"
                label="Today"
                active={dayIso === todayIso && !picking}
                onPress={() => {
                  setDayIso(todayIso);
                  setPicking(false);
                }}
              />
              {yesterdayIso >= firstIso ? (
                <FilterPill
                  testID="cashAllocDayYesterday"
                  label="Yesterday"
                  active={dayIso === yesterdayIso && !picking}
                  onPress={() => {
                    setDayIso(yesterdayIso);
                    setPicking(false);
                  }}
                />
              ) : null}
              <FilterPill
                testID="cashAllocDayPick"
                label={
                  dayIso !== todayIso && dayIso !== yesterdayIso && !picking
                    ? shortDate(dayIso)
                    : 'Earlier day'
                }
                active={picking || (dayIso !== todayIso && dayIso !== yesterdayIso)}
                dropdown
                onPress={() => setPicking(!picking)}
              />
            </View>
            {picking ? (
              <DayPicker value={dayIso} min={firstIso} max={todayIso} onPick={pickDay} />
            ) : null}
          </View>

          {error ? (
            <Text testID="cashAllocError" className="font-inter text-caption text-warn">
              {error}
            </Text>
          ) : null}
          <Button
            testID="cashAllocSave"
            label={editing === null ? 'Add to the breakdown' : 'Save changes'}
            disabled={busy}
            onPress={() => void save()}
          />
          {breakdown.allocations.length > 0 || editing !== null ? (
            <View className="items-center">
              <TextLink testID="cashAllocCancelLink" label="Cancel" onPress={reset} />
            </View>
          ) : null}
        </View>
      ) : breakdown.left > 0 ? (
        <Button
          testID="cashAllocAddBtn"
          label="Add spending"
          variant="outline"
          onPress={() => {
            setOpen(true);
            setError(null);
          }}
        />
      ) : (
        <Text testID="cashAllocDone" className="font-inter text-body leading-6 text-muted">
          All of it is accounted for.
        </Text>
      )}
      {breakdown.allocations.length === 0 ? (
        <View className="items-center">
          <TextLink
            testID="cashAllocQuickLink"
            label="It was all one thing? Answer quickly"
            onPress={() => router.replace(`/sheets/cash-out?id=${breakdown.id}`)}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
