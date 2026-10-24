import { formatGhs, pesewas } from '../money';

const DAY_MS = 86_400_000;

/** Midnight UTC of the day `ms` falls on. The app keeps its days in UTC. */
export const startOfUtcDay = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;

/** What is still unaccounted for. Never negative, so a cash-out that shrank after the fact reads 0. */
export const amountLeft = (cashOut: number, allocated: number): number =>
  Math.max(cashOut - allocated, 0);

export interface AllocationDraft {
  /** `null` until the user picks one. */
  categoryId: string | null;
  amount: number | null;
  /** Epoch ms of the day it was spent. */
  spentOn: number;
}

export interface AllocationContext {
  /** Room for this entry: what is left, plus the entry's own old amount when editing. */
  room: number;
  cashOutAt: number;
  now: number;
}

/**
 * The first reason a draft cannot be saved, in plain words, or null. One function so the form
 * and the ledger write say the same thing.
 */
export function allocationProblem(draft: AllocationDraft, ctx: AllocationContext): string | null {
  if (draft.categoryId === null || draft.categoryId === '') return 'Pick a category.';
  if (draft.amount === null || !Number.isSafeInteger(draft.amount) || draft.amount <= 0) {
    return 'Amount must be more than 0.';
  }
  if (draft.amount > ctx.room) {
    return ctx.room === 0
      ? 'Nothing is left to break down.'
      : `That is more than what is left (${formatGhs(pesewas(ctx.room))}).`;
  }
  if (startOfUtcDay(draft.spentOn) < startOfUtcDay(ctx.cashOutAt)) {
    return 'Pick a day on or after the withdrawal.';
  }
  if (startOfUtcDay(draft.spentOn) > startOfUtcDay(ctx.now)) return 'That day has not come yet.';
  return null;
}
