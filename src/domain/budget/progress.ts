import { formatGhs, pesewas } from '../money';
import { shortDate } from '../calendar/week';
import {
  daysBetween,
  perDayOf,
  planDays,
  type PlanSpan,
  type PlanStatus,
  planStatus,
} from './plan';

export type Tone = 'fine' | 'watch' | 'over';

export interface Progress {
  limit: number;
  /** Net spend, never below 0. */
  spent: number;
  /** Never below 0. */
  left: number;
  /** How far past the limit, never below 0. */
  over: number;
  /** 0 to 1, for a bar. */
  fraction: number;
  tone: Tone;
}

/** A line goes amber once four fifths of its limit are gone. */
export function progressOf(limit: number, rawSpent: number): Progress {
  const spent = Math.max(rawSpent, 0);
  const tone: Tone =
    spent > limit ? 'over' : spent > 0 && spent * 5 >= limit * 4 ? 'watch' : 'fine';
  return {
    limit,
    spent,
    left: Math.max(limit - spent, 0),
    over: Math.max(spent - limit, 0),
    fraction: limit > 0 ? Math.min(spent / limit, 1) : spent > 0 ? 1 : 0,
    tone,
  };
}

export interface Pace {
  status: PlanStatus;
  days: number;
  /** Which day of the plan today is, 1 based. 0 before it starts, `days` once it has ended. */
  dayNumber: number;
  /** Days still to spend in, today included. 0 unless the plan is running. */
  daysLeft: number;
  /** Days until it starts. 0 unless the plan is upcoming. */
  startsIn: number;
  /** What an even pace would have spent by the end of today. */
  expected: number;
  /** What can be spent each remaining day, today included, and still finish inside the plan. */
  safePerDay: number;
  /** The plan's own daily pace: the amount the user stated, else the total over the days. */
  perDay: number;
  /** What an even pace allows by now minus what was spent. Negative means behind. 0 before it starts. */
  cushion: number;
}

export function paceOf(
  plan: PlanSpan & { total: number; daily?: number | null },
  spent: number,
  todayIso: string,
): Pace {
  const days = planDays(plan.startDay, plan.endDay);
  const status = planStatus(plan, todayIso);
  const perDay = plan.daily ?? perDayOf(plan.total, days);
  if (status === 'upcoming') {
    return {
      status,
      days,
      dayNumber: 0,
      daysLeft: 0,
      startsIn: daysBetween(todayIso, plan.startDay),
      expected: 0,
      safePerDay: 0,
      perDay,
      cushion: 0,
    };
  }
  if (status === 'ended') {
    return {
      status,
      days,
      dayNumber: days,
      daysLeft: 0,
      startsIn: 0,
      expected: plan.total,
      safePerDay: 0,
      perDay,
      cushion: plan.total - Math.max(spent, 0),
    };
  }
  const dayNumber = daysBetween(plan.startDay, todayIso) + 1;
  const daysLeft = days - dayNumber + 1;
  const expected = Math.round((plan.total * dayNumber) / days);
  return {
    status,
    days,
    dayNumber,
    daysLeft,
    startsIn: 0,
    expected,
    safePerDay: Math.floor(Math.max(plan.total - Math.max(spent, 0), 0) / daysLeft),
    perDay,
    cushion: expected - Math.max(spent, 0),
  };
}

const money = (n: number) => formatGhs(pesewas(n));
const dayWord = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** One warm sentence about where the plan stands. It never scolds. */
export function paceLine(plan: PlanSpan, total: Progress, pace: Pace): string {
  if (pace.status === 'upcoming') return `Starts ${shortDate(plan.startDay)}.`;
  if (pace.status === 'ended') {
    if (total.over > 0) return `You finished ${money(total.over)} over.`;
    if (total.left > 0) return `You finished with ${money(total.left)} to spare.`;
    return 'You used the plan to the pesewa.';
  }
  if (total.over > 0) return `${money(total.over)} over, with ${dayWord(pace.daysLeft)} to go.`;
  if (pace.daysLeft === 1) return `Last day. ${money(total.left)} left to spend.`;
  if (total.left === 0) return `All of it is spent, with ${dayWord(pace.daysLeft)} to go.`;
  return `${money(pace.safePerDay)} a day keeps you inside it.`;
}
