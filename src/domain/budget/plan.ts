import { formatGhs, pesewas } from '../money';
import type { TimeRange } from '../calendar/month';
import { shortDate } from '../calendar/week';

const DAY_MS = 86_400_000;

/** A plan can run for up to a year, so one plan never needs a second page of days. */
export const MAX_PLAN_DAYS = 366;
export const MAX_NAME_LENGTH = 30;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** A real calendar day written `YYYY-MM-DD`. `2026-02-30` is not one. */
export const isIsoDay = (value: string): boolean =>
  ISO.test(value) &&
  !Number.isNaN(dayMs(value)) &&
  new Date(dayMs(value)).toISOString().slice(0, 10) === value;

export const addDays = (iso: string, days: number): string =>
  new Date(dayMs(iso) + days * DAY_MS).toISOString().slice(0, 10);

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((dayMs(to) - dayMs(from)) / DAY_MS);

/** Both end days count, so one day long is `start === end`. */
export const planDays = (startDay: string, endDay: string): number =>
  daysBetween(startDay, endDay) + 1;

/** The plan's days as the `[start, end)` range every ledger query takes. */
export const planRange = (startDay: string, endDay: string): TimeRange => ({
  start: dayMs(startDay),
  end: dayMs(endDay) + DAY_MS,
});

export const monthEndDay = (iso: string): string => {
  const [year = 1970, month = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
};

export type PeriodPreset = 'week' | 'fortnight' | 'month' | 'custom';

export const PERIOD_PRESETS: readonly { id: PeriodPreset; label: string }[] = [
  { id: 'week', label: '1 week' },
  { id: 'fortnight', label: '2 weeks' },
  { id: 'month', label: 'To month end' },
  { id: 'custom', label: 'Pick an end day' },
];

/** The last day of a preset period that begins on `startDay`. */
export function presetEnd(startDay: string, preset: Exclude<PeriodPreset, 'custom'>): string {
  if (preset === 'week') return addDays(startDay, 6);
  if (preset === 'fortnight') return addDays(startDay, 13);
  return monthEndDay(startDay);
}

export type PlanStatus = 'upcoming' | 'active' | 'ended';

export interface PlanSpan {
  startDay: string;
  endDay: string;
}

export function planStatus(plan: PlanSpan, todayIso: string): PlanStatus {
  if (todayIso < plan.startDay) return 'upcoming';
  return todayIso > plan.endDay ? 'ended' : 'active';
}

/**
 * The plan the app puts in front of the user: the one running today, else the next one to start,
 * else the one that ended last. Null when there are no plans.
 */
export function featuredPlan<T extends PlanSpan>(plans: readonly T[], todayIso: string): T | null {
  const byStart = [...plans].sort((a, b) => a.startDay.localeCompare(b.startDay));
  const active = byStart.find((p) => planStatus(p, todayIso) === 'active');
  if (active) return active;
  const upcoming = byStart.find((p) => planStatus(p, todayIso) === 'upcoming');
  if (upcoming) return upcoming;
  return byStart.at(-1) ?? null;
}

export interface PlanDraft extends PlanSpan {
  /** Pesewas; null until the user types one. */
  total: number | null;
  name?: string | null;
}

export interface PlanContext {
  /** Every other plan, so two plans never cover the same day. */
  others: readonly PlanSpan[];
  /** What the plan's category limits add up to today (0 for a new plan). */
  limitsTotal: number;
}

/** The text a plan is stored with: trimmed, or null when blank. */
export const cleanName = (name: string | null | undefined): string | null => {
  const text = name?.trim() ?? '';
  return text === '' ? null : text;
};

/**
 * The first reason a plan cannot be saved, in plain words, or null. One function so the form
 * and the ledger write say the same thing.
 */
export function planProblem(draft: PlanDraft, ctx: PlanContext): string | null {
  if (!isIsoDay(draft.startDay)) return 'Pick the day it starts.';
  if (!isIsoDay(draft.endDay)) return 'Pick the day it ends.';
  if (draft.endDay < draft.startDay) return 'A plan cannot end before it starts.';
  if (planDays(draft.startDay, draft.endDay) > MAX_PLAN_DAYS) {
    return 'A plan can run for up to a year.';
  }
  if (draft.total === null || !Number.isSafeInteger(draft.total) || draft.total <= 0) {
    return 'Enter how much you plan to spend.';
  }
  if (draft.total < ctx.limitsTotal) {
    return `Your category limits add up to ${formatGhs(pesewas(ctx.limitsTotal))}. Raise the total or lower them first.`;
  }
  if ((cleanName(draft.name) ?? '').length > MAX_NAME_LENGTH) {
    return `Keep the name under ${MAX_NAME_LENGTH + 1} letters.`;
  }
  const clash = ctx.others.find((o) => o.startDay <= draft.endDay && o.endDay >= draft.startDay);
  if (clash) {
    return `That overlaps your plan for ${shortDate(clash.startDay)} to ${shortDate(clash.endDay)}.`;
  }
  return null;
}

export interface LimitDraft {
  categoryId: string | null;
  /** Pesewas; null until typed. */
  amount: number | null;
}

/** `room` is the plan's total minus every other category's limit. */
export function limitProblem(draft: LimitDraft, room: number): string | null {
  if (draft.categoryId === null || draft.categoryId === '') return 'Pick a category.';
  if (draft.categoryId === 'income') return 'Income is not spending, so it takes no limit.';
  if (draft.amount === null || !Number.isSafeInteger(draft.amount) || draft.amount <= 0) {
    return 'Enter an amount above 0.';
  }
  if (draft.amount > room) {
    return room <= 0
      ? 'The plan has nothing left to give. Raise the total first.'
      : `That is more than the plan has left to give (${formatGhs(pesewas(room))}).`;
  }
  return null;
}

/** Limits cannot add up to more than the total. Used when many are written at once. */
export function limitsProblem(
  limits: readonly { categoryId: string; amount: number }[],
  total: number,
): string | null {
  const seen = new Set<string>();
  let sum = 0;
  for (const l of limits) {
    const problem = limitProblem({ categoryId: l.categoryId, amount: l.amount }, total);
    if (problem !== null) return problem;
    if (seen.has(l.categoryId)) return 'Each category can have one limit.';
    seen.add(l.categoryId);
    sum += l.amount;
  }
  if (sum > total) {
    return `The limits add up to ${formatGhs(pesewas(sum))}, which is more than the total.`;
  }
  return null;
}
