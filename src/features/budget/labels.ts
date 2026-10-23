import { planDays, planStatus, type PlanSpan } from '@/domain/budget/plan';
import type { Pace, Progress } from '@/domain/budget/progress';
import { shortDate } from '@/domain/calendar/week';
import { formatGhs, pesewas } from '@/domain/money';

export const ghs = (n: number): string => formatGhs(pesewas(n));

const dayWord = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** "7 Nov": the day and month without the weekday. */
export const dayMonth = (iso: string): string => shortDate(iso).replace(/^\S+ /, '');

/** The name, else the dates: "1 Nov to 30 Nov". */
export function planLabel(plan: PlanSpan & { name: string | null }): string {
  return plan.name ?? `${dayMonth(plan.startDay)} to ${dayMonth(plan.endDay)}`;
}

/** "Sat 7 Nov · 7 days", with a note when the start is already past. */
export function periodSummary(startDay: string, endDay: string, todayIso: string): string {
  const base = `${shortDate(startDay)} · ${dayWord(planDays(startDay, endDay))}`;
  return startDay < todayIso
    ? `${base}. Counts what you already spent since ${shortDate(startDay)}.`
    : base;
}

interface SettingsPlan extends PlanSpan {
  total: number;
  spent: number;
}

export function settingsSubtitle(featured: SettingsPlan | null, todayIso: string): string {
  if (featured === null) return 'Plan how much to spend';
  const status = planStatus(featured, todayIso);
  if (status === 'upcoming') return `Starts ${shortDate(featured.startDay)}`;
  if (status === 'ended') return `Last plan ended ${dayMonth(featured.endDay)}`;
  const span = `${dayMonth(featured.startDay)} to ${dayMonth(featured.endDay)}`;
  const gap = featured.total - featured.spent;
  return `${span} · ${gap >= 0 ? `${ghs(gap)} left` : `${ghs(-gap)} over`}`;
}

export function statusChip(pace: Pace): string {
  if (pace.status === 'ended') return 'Ended';
  if (pace.status === 'upcoming') {
    return pace.startsIn === 1 ? 'Starts tomorrow' : `Starts in ${dayWord(pace.startsIn)}`;
  }
  return `Day ${pace.dayNumber} of ${pace.days}`;
}

export function rowRight(progress: Progress): string {
  return progress.over > 0 ? `${ghs(progress.over)} over` : `${ghs(progress.left)} left`;
}

export interface Hero {
  label: string;
  amount: number;
  over: boolean;
}

/** The big number: what is left, or by how much the plan was passed. */
export function heroOf(total: Progress, pace: Pace): Hero {
  if (total.over > 0) return { label: 'Over by', amount: total.over, over: true };
  return {
    label: pace.status === 'ended' ? 'Finished with' : 'Left',
    amount: total.left,
    over: false,
  };
}

export function barLabel(total: Progress, pace: Pace): string {
  const base = `${ghs(total.spent)} of ${ghs(total.limit)} spent`;
  return pace.status === 'active' ? `${base}, day ${pace.dayNumber} of ${pace.days}` : base;
}
