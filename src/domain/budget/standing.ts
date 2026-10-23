import { formatGhs, pesewas } from '../money';
import type { Pace } from './progress';

const money = (n: number) => formatGhs(pesewas(n));

export type StandingStatus = 'safe' | 'behind';

export interface Standing {
  status: StandingStatus;
  /** How far ahead of or behind the daily pace, never negative. */
  amount: number;
  line: string;
}

/**
 * Whether spending is inside the daily pace so far. By the end of day N a plan allows N days of
 * its daily amount, so a day not yet spent counts in the user's favour. Only a running plan has
 * a standing.
 */
export function standingOf(pace: Pace): Standing | null {
  if (pace.status !== 'active') return null;
  const amount = Math.abs(pace.cushion);
  if (pace.cushion < 0) {
    return {
      status: 'behind',
      amount,
      line: `Behind by ${money(amount)} against ${money(pace.perDay)} a day.`,
    };
  }
  return {
    status: 'safe',
    amount,
    line:
      amount === 0
        ? `Safe. Right on ${money(pace.perDay)} a day.`
        : `Safe. ${money(amount)} under ${money(pace.perDay)} a day.`,
  };
}

export interface Today {
  spent: number;
  allowance: number;
  /** Never below 0. */
  left: number;
  /** Never below 0. */
  over: number;
  line: string;
}

/** Today's spending against the plan's daily amount. Only a running plan has a today. */
export function todayOf(pace: Pace, rawSpent: number): Today | null {
  if (pace.status !== 'active') return null;
  const spent = Math.max(rawSpent, 0);
  const allowance = pace.perDay;
  const over = Math.max(spent - allowance, 0);
  return {
    spent,
    allowance,
    left: Math.max(allowance - spent, 0),
    over,
    line:
      over > 0
        ? `Today: ${money(spent)}, ${money(over)} over ${money(allowance)}.`
        : `Today: ${money(spent)} of ${money(allowance)}.`,
  };
}
