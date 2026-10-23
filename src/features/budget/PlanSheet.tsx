import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import type { PlanRow } from '@/data/queries';
import {
  addDays,
  cleanName,
  defaultPreset,
  MAX_PLAN_DAYS,
  PERIOD_PRESETS,
  planDays,
  planProblem,
  presetEnd,
  type PeriodPreset,
} from '@/domain/budget/plan';
import { suggestPlan } from '@/domain/budget/suggest';
import { isoDate, shortDate } from '@/domain/calendar/week';
import { formatPlain, parseAmount, pesewas } from '@/domain/money';
import { useWrite } from '@/features/app';
import { useToday } from '@/features/period';
import { DayPicker } from '@/features/transactions/components/DayPicker';
import { createPlan, updatePlan } from '@/ledger/budgets';
import { Button, DashedChip, FilterPill, Sheet, SheetTitle, TextField } from '@/ui';

import { dayMonth, ghs, periodSummary } from './labels';
import { useBudgetHistory, useBudgetView, usePlans } from './useBudget';

const LABEL = 'font-inter-bold text-[14px] leading-[19px] text-ink';
const PICK_BACK_DAYS = 92;
const PICK_FORWARD_DAYS = 366;

const numeric = (text: string | undefined): number | null =>
  text !== undefined && /^\d+$/.test(text) ? Number(text) : null;

export function PlanSheet() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const plans = usePlans();
  const editId = numeric(id);
  const view = useBudgetView(editId);
  if (plans === undefined || view === undefined)
    return <Sheet testID="budgetPlanSheet">{null}</Sheet>;

  const editing = editId === null ? null : (plans.find((p) => p.id === editId) ?? null);
  const base = numeric(from);
  const previous = base === null ? null : (plans.find((p) => p.id === base) ?? null);
  const limitsTotal = view?.categories.reduce((sum, c) => sum + c.progress.limit, 0) ?? 0;
  return <Form plans={plans} editing={editing} previous={previous} limitsTotal={limitsTotal} />;
}

interface Start {
  startDay: string;
  endDay: string;
  preset: PeriodPreset;
  total: string;
  name: string;
}

function initialFor(editing: PlanRow | null, previous: PlanRow | null, todayIso: string): Start {
  if (editing) {
    return {
      startDay: editing.startDay,
      endDay: editing.endDay,
      preset: 'custom',
      total: formatPlain(pesewas(editing.total)),
      name: editing.name ?? '',
    };
  }
  if (previous) {
    const startDay = addDays(previous.endDay, 1);
    const length = planDays(previous.startDay, previous.endDay);
    return {
      startDay,
      endDay: addDays(startDay, length - 1),
      preset: 'custom',
      total: formatPlain(pesewas(previous.total)),
      name: '',
    };
  }
  const preset = defaultPreset(todayIso);
  return {
    startDay: todayIso,
    endDay: presetEnd(todayIso, preset),
    preset,
    total: '',
    name: '',
  };
}

function Form({
  plans,
  editing,
  previous,
  limitsTotal,
}: {
  plans: PlanRow[];
  editing: PlanRow | null;
  previous: PlanRow | null;
  limitsTotal: number;
}) {
  const router = useRouter();
  const today = useToday();
  const todayIso = isoDate(today);
  const tomorrowIso = addDays(todayIso, 1);
  const { run, busy, error, setError } = useWrite();

  const [initial] = useState(() => initialFor(editing, previous, todayIso));
  const [startDay, setStartDay] = useState(initial.startDay);
  const [endDay, setEndDay] = useState(initial.endDay);
  const [preset, setPreset] = useState<PeriodPreset>(initial.preset);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [pickingStart, setPickingStart] = useState(false);
  const [totalText, setTotalText] = useState(initial.total);
  const [name, setName] = useState(initial.name);

  const length = Math.min(Math.max(planDays(startDay, endDay), 1), MAX_PLAN_DAYS);
  const history = useBudgetHistory(startDay, length);
  const suggestion = history ? suggestPlan(history.spend, history.days, length) : null;

  const changeStart = (iso: string) => {
    setStartDay(iso);
    setError(null);
    if (preset !== 'custom') setEndDay(presetEnd(iso, preset));
    else if (endDay < iso || planDays(iso, endDay) > MAX_PLAN_DAYS) setEndDay(iso);
  };

  const changePreset = (next: PeriodPreset) => {
    setError(null);
    if (next === 'custom') {
      setPickingEnd(preset !== 'custom' || !pickingEnd);
    } else {
      setEndDay(presetEnd(startDay, next));
      setPickingEnd(false);
    }
    setPreset(next);
  };

  const save = async () => {
    const total = parseAmount(totalText);
    const draft = { startDay, endDay, total, name };
    const problem = planProblem(draft, {
      others: plans.filter((p) => p.id !== editing?.id),
      limitsTotal,
    });
    if (problem !== null || total === null) {
      setError(problem ?? 'Enter how much you plan to spend.');
      return;
    }
    const input = { startDay, endDay, total, name: cleanName(name) };
    const saved = await run(
      (db) => (editing === null ? createPlan(db, input) : updatePlan(db, editing.id, input)),
      ['money'],
    );
    if (!saved) return;
    if (saved.value.ok) router.back();
    else setError(saved.value.message);
  };

  const startsOtherDay = startDay !== todayIso && startDay !== tomorrowIso;

  return (
    <Sheet testID="budgetPlanSheet">
      <SheetTitle title={editing === null ? 'Make a plan' : 'Change your plan'} />

      <View className="gap-2">
        <Text className={LABEL}>How long?</Text>
        <View className="flex-row flex-wrap gap-2">
          {PERIOD_PRESETS.map((p) => (
            <FilterPill
              key={p.id}
              testID={`budgetPreset-${p.id}`}
              label={
                p.id === 'custom' && preset === 'custom' ? `Ends ${dayMonth(endDay)}` : p.label
              }
              active={preset === p.id}
              onPress={() => changePreset(p.id)}
            />
          ))}
        </View>
        {preset === 'custom' && pickingEnd ? (
          <DayPicker
            testIDPrefix="budgetDay"
            value={endDay}
            min={startDay}
            max={addDays(startDay, MAX_PLAN_DAYS - 1)}
            onPick={(iso) => {
              setEndDay(iso);
              setPickingEnd(false);
              setError(null);
            }}
          />
        ) : null}
      </View>

      <View className="gap-2">
        <Text className={LABEL}>Starts</Text>
        <View className="flex-row flex-wrap gap-2">
          <FilterPill
            testID="budgetStartToday"
            label="Today"
            active={startDay === todayIso && !pickingStart}
            onPress={() => {
              changeStart(todayIso);
              setPickingStart(false);
            }}
          />
          <FilterPill
            testID="budgetStartTomorrow"
            label="Tomorrow"
            active={startDay === tomorrowIso && !pickingStart}
            onPress={() => {
              changeStart(tomorrowIso);
              setPickingStart(false);
            }}
          />
          <FilterPill
            testID="budgetStartPick"
            label={startsOtherDay && !pickingStart ? shortDate(startDay) : 'Another day'}
            active={pickingStart || startsOtherDay}
            dropdown
            onPress={() => setPickingStart(!pickingStart)}
          />
        </View>
        {pickingStart ? (
          <DayPicker
            testIDPrefix="budgetStartDay"
            value={startDay}
            min={addDays(todayIso, -PICK_BACK_DAYS)}
            max={addDays(todayIso, PICK_FORWARD_DAYS)}
            onPick={(iso) => {
              changeStart(iso);
              setPickingStart(false);
            }}
          />
        ) : null}
        <Text testID="budgetPlanSummary" className="font-inter text-caption text-muted">
          {periodSummary(startDay, endDay, todayIso)}
        </Text>
      </View>

      <View className="gap-2">
        <Text className={LABEL}>How much will you spend?</Text>
        <TextField
          testID="budgetTotalInput"
          value={totalText}
          onChangeText={(t) => {
            setTotalText(t);
            setError(null);
          }}
          placeholder="1000"
          keyboardType="decimal-pad"
        />
        {suggestion && history ? (
          <View className="flex-row">
            <DashedChip
              testID="budgetTotalSuggestion"
              label={`Like the ${history.days} days before: ${ghs(suggestion.total)}`}
              onPress={() => {
                setTotalText(formatPlain(pesewas(suggestion.total)));
                setError(null);
              }}
            />
          </View>
        ) : null}
      </View>

      <View className="gap-2">
        <Text className={LABEL}>Name it, if you like</Text>
        <TextField
          testID="budgetNameInput"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="November"
        />
      </View>

      {error ? (
        <Text testID="budgetPlanError" className="font-inter text-caption text-warn">
          {error}
        </Text>
      ) : null}
      <Button
        testID="budgetPlanSaveBtn"
        label={editing === null ? 'Start my plan' : 'Save changes'}
        disabled={busy}
        onPress={() => void save()}
      />
    </Sheet>
  );
}
