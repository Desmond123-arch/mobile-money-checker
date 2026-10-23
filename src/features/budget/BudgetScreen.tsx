import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import type { PlanRow } from '@/data/queries';
import { featuredPlan, planDays, planStatus } from '@/domain/budget/plan';
import { fitToTotal, suggestPlan } from '@/domain/budget/suggest';
import { isoDate } from '@/domain/calendar/week';
import { pesewas } from '@/domain/money';
import { useWrite } from '@/features/app';
import { categoryById } from '@/features/categories';
import { useToday } from '@/features/period';
import { deletePlan, replaceLimits } from '@/ledger/budgets';
import { Amount, BackButton, Button, DashedChip, Hint, Screen, SubHeading, TextLink } from '@/ui';

import { BudgetBar } from './components/BudgetBar';
import { LineRow } from './components/LineRow';
import { barLabel, dayMonth, ghs, heroOf, planLabel, statusChip } from './labels';
import { useBudgetHistory, useBudgetView, usePlans } from './useBudget';

const TITLE = 'font-tight-extrabold text-[34px] leading-[44px] tracking-[-0.03em] text-ink';
const NEUTRAL = { tint: '#EDEDED', color: '#9A9A9A' };

export function BudgetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const todayIso = isoDate(useToday());
  const plans = usePlans();
  const { run, busy, error, setError } = useWrite();

  const shown = pickPlan(plans, id, todayIso);
  const days = shown ? planDays(shown.startDay, shown.endDay) : 1;
  const view = useBudgetView(shown?.id ?? null);
  const history = useBudgetHistory(shown?.startDay ?? null, days);

  const back = (
    <View className="px-5 pt-2">
      <BackButton onPress={() => router.back()} />
    </View>
  );

  if (plans === undefined) {
    return <Screen testID="budgetScreen">{back}</Screen>;
  }

  if (plans.length === 0) {
    return (
      <Screen testID="budgetScreen">
        {back}
        <View testID="budgetEmpty" className="gap-5 px-5 pt-6">
          <View className="gap-[10px]">
            <Text className={TITLE}>Plan your spending.</Text>
            <Text className="font-inter text-body leading-6 text-muted">
              Pick how long, say how much, and watch it count down. Add limits for the things you
              care about.
            </Text>
          </View>
          <Button
            testID="budgetCreateBtn"
            label="Make a plan"
            onPress={() => router.push('/sheets/budget-plan')}
          />
          <Hint title="Limits are optional">
            A total is enough to begin. Anything without a limit counts under Everything else.
          </Hint>
        </View>
      </Screen>
    );
  }

  if (!shown || !view) {
    return <Screen testID="budgetScreen">{back}</Screen>;
  }

  const ended = view.status === 'ended';
  const active = view.status === 'active';
  const hero = heroOf(view.total, view.pace);
  const suggestion = history ? suggestPlan(history.spend, history.days, days) : null;
  const others = plans.filter((p) => p.id !== shown.id);

  const startFromHistory = async () => {
    if (!suggestion) return;
    const limits = fitToTotal(suggestion.limits, shown.total);
    if (limits.length === 0) {
      setError('Raise the total first.');
      return;
    }
    const saved = await run((db) => replaceLimits(db, shown.id, limits), ['money']);
    if (saved && !saved.value.ok) setError(saved.value.message);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this plan?', 'Your spending is not touched.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void run((db) => deletePlan(db, shown.id), ['money']),
      },
    ]);
  };

  const addLimit = () => router.push(`/sheets/budget-limit?plan=${shown.id}`);

  return (
    <Screen testID="budgetScreen">
      {back}
      <View className="gap-6 px-5 pt-6">
        <Text className={TITLE}>Budget</Text>

        <View testID="budgetHero" className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-inter-bold text-body leading-[21px] text-ink"
            >
              {planLabel(shown)}
            </Text>
            <View className="shrink-0 rounded-full bg-hairline px-3 py-1">
              <Text testID="budgetStatusChip" className="font-inter-semibold text-caption text-ink">
                {statusChip(view.pace)}
              </Text>
            </View>
          </View>
          <View className="gap-1">
            <Text className="font-inter-bold text-caption text-muted">{hero.label}</Text>
            <View className="flex-row flex-wrap items-baseline gap-x-3">
              <Amount testID="budgetLeft" amount={pesewas(hero.amount)} />
              <Text testID="budgetOf" className="font-inter text-body text-muted">
                of {ghs(view.total.limit)}
              </Text>
            </View>
          </View>
          <BudgetBar
            testID="budgetBar"
            fraction={view.total.fraction}
            tone={view.total.tone}
            {...(active && shown.total > 0 ? { marker: view.pace.expected / shown.total } : {})}
            accessibilityLabel={barLabel(view.total, view.pace)}
          />
          <Text
            testID="budgetHeadline"
            className={`font-inter text-caption ${hero.over ? 'text-warn' : 'text-muted'}`}
          >
            {view.headline}
          </Text>
        </View>

        <View className="gap-1">
          <SubHeading title="By category" />
          {view.categories.map((line) => {
            const category = categoryById(line.categoryId);
            return (
              <LineRow
                key={line.categoryId}
                testID={`budgetRow-${line.categoryId}`}
                name={category?.name ?? 'Other'}
                caption={`${ghs(line.progress.spent)} of ${ghs(line.progress.limit)}`}
                progress={line.progress}
                tint={category?.tint ?? NEUTRAL.tint}
                color={category?.color ?? NEUTRAL.color}
                onPress={() =>
                  router.push(`/sheets/budget-limit?plan=${shown.id}&category=${line.categoryId}`)
                }
              />
            );
          })}
          {view.rest ? (
            <LineRow
              testID="budgetRestRow"
              name="Everything else"
              caption={
                view.rest.limit === 0
                  ? 'Not planned for'
                  : `${ghs(view.rest.spent)} of ${ghs(view.rest.limit)}`
              }
              progress={view.rest}
              tint={NEUTRAL.tint}
              color={NEUTRAL.color}
            />
          ) : null}
        </View>

        {!ended ? (
          <View className="flex-row">
            <DashedChip testID="budgetAddLimitBtn" label="Add a limit" icon onPress={addLimit} />
          </View>
        ) : null}
        {!ended && view.categories.length === 0 && suggestion && history ? (
          <Button
            testID="budgetSuggestBtn"
            variant="outline"
            label={`Start from your last ${history.days} days`}
            disabled={busy}
            onPress={() => void startFromHistory()}
          />
        ) : null}
        {ended ? (
          <Button
            testID="budgetNextBtn"
            label="Plan the next one"
            onPress={() => router.push(`/sheets/budget-plan?from=${shown.id}`)}
          />
        ) : null}
        {error ? (
          <Text testID="budgetError" className="font-inter text-caption text-warn">
            {error}
          </Text>
        ) : null}

        <View className="flex-row items-center gap-5">
          {!ended ? (
            <TextLink
              testID="budgetEditLink"
              label="Edit plan"
              onPress={() => router.push(`/sheets/budget-plan?id=${shown.id}`)}
            />
          ) : null}
          <Pressable
            testID="budgetDeleteLink"
            accessibilityRole="link"
            onPress={confirmDelete}
            className="p-[6px]"
          >
            <Text className="font-inter-semibold text-[15px] text-warn underline">Delete plan</Text>
          </Pressable>
        </View>

        {others.length > 0 ? (
          <View testID="budgetHistoryList" className="gap-1">
            <SubHeading title="Other plans" />
            {others.map((p) => (
              <HistoryRow
                key={p.id}
                plan={p}
                todayIso={todayIso}
                onPress={() => router.setParams({ id: String(p.id) })}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function pickPlan(plans: PlanRow[] | undefined, id: string | undefined, todayIso: string) {
  if (plans === undefined) return null;
  const chosen = id === undefined ? undefined : plans.find((p) => String(p.id) === id);
  return chosen ?? featuredPlan(plans, todayIso);
}

function HistoryRow({
  plan,
  todayIso,
  onPress,
}: {
  plan: PlanRow;
  todayIso: string;
  onPress: () => void;
}) {
  const status = planStatus(plan, todayIso);
  const word =
    status === 'ended'
      ? plan.spent > plan.total
        ? 'Over'
        : 'Under'
      : status === 'active'
        ? 'Now'
        : 'Next';
  return (
    <Pressable
      testID={`budgetHistoryRow-${plan.id}`}
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 py-3"
    >
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text numberOfLines={1} className="font-inter-semibold text-body leading-[22px] text-ink">
          {planLabel(plan)}
        </Text>
        <Text numberOfLines={1} className="font-inter text-caption text-muted">
          {dayMonth(plan.startDay)} to {dayMonth(plan.endDay)} · {ghs(plan.spent)} spent of{' '}
          {ghs(plan.total)}
        </Text>
      </View>
      <Text
        className={`w-[56px] shrink-0 text-right font-inter-semibold text-caption ${word === 'Over' ? 'text-warn' : 'text-muted'}`}
      >
        {word}
      </Text>
    </Pressable>
  );
}
