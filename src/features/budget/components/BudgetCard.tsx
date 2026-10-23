import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { planStatus } from '@/domain/budget/plan';
import { isoDate } from '@/domain/calendar/week';
import { pesewas } from '@/domain/money';
import { useToday } from '@/features/period';
import { Amount, Icon, SectionHeader } from '@/ui';

import { barLabel, heroOf } from '../labels';
import { useBudgetView, useFeaturedPlan } from '../useBudget';
import { BudgetBar } from './BudgetBar';

/** The Home section: today's plan at a glance, or a quiet invitation to make one. */
export function BudgetCard() {
  const router = useRouter();
  const todayIso = isoDate(useToday());
  const data = useFeaturedPlan();
  const featured = data?.featured ?? null;
  const running = featured !== null && planStatus(featured, todayIso) !== 'ended';
  const view = useBudgetView(running ? featured.id : null);

  if (data === undefined) return null;

  if (!running) {
    return (
      <View className="px-5 pt-9">
        <Pressable
          testID="homeBudgetPlanLink"
          accessibilityRole="button"
          onPress={() => router.push('/sheets/budget-plan')}
          className="min-h-11 flex-row items-center gap-3 py-2"
        >
          <View className="min-w-0 flex-1 gap-[2px]">
            <Text className="font-inter-semibold text-body leading-[21px] text-ink">
              Plan your spending
            </Text>
            <Text className="font-inter text-caption text-muted">Set how long and how much</Text>
          </View>
          <Icon name="chevronRight" size={16} strokeWidth={1.75} />
        </Pressable>
      </View>
    );
  }

  if (!view) return null;
  const hero = heroOf(view.total, view.pace);
  const active = view.status === 'active';

  return (
    <View testID="homeBudgetCard" className="gap-3 px-5 pt-9">
      <SectionHeader
        title="Budget"
        link="Details"
        linkTestID="homeBudgetDetailsLink"
        onLinkPress={() => router.push('/budget')}
      />
      <View className="flex-row items-baseline gap-2">
        <Amount size="md" amount={pesewas(hero.amount)} />
        <Text className={`font-inter-medium text-body ${hero.over ? 'text-warn' : 'text-muted'}`}>
          {hero.over ? 'over' : 'left'}
        </Text>
      </View>
      <BudgetBar
        fraction={view.total.fraction}
        tone={view.total.tone}
        {...(active && view.plan.total > 0 ? { marker: view.pace.expected / view.plan.total } : {})}
        accessibilityLabel={barLabel(view.total, view.pace)}
      />
      <Text className={`font-inter text-caption ${hero.over ? 'text-warn' : 'text-muted'}`}>
        {view.headline}
      </Text>
    </View>
  );
}
