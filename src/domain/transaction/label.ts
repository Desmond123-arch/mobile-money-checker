import { dayState, isoDate, shortDate } from '../calendar/week';

const KIND_LABELS: Readonly<Record<string, string>> = {
  payment_out: 'Paid to a merchant.',
  transfer_out: 'Sent to a person.',
  cash_out: 'Cash taken out at an agent.',
  payment_in: 'Money received.',
  cash_in: 'Cash put in at an agent.',
  interest: 'Interest paid to you.',
  refund: 'A refund.',
  reversal: 'A payment that was reversed.',
};

const FALLBACK_NAMES: Readonly<Record<string, string>> = {
  cash_out: 'Cash out',
  cash_in: 'Cash in',
  interest: 'Interest',
  refund: 'Refund',
  reversal: 'Reversal',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? 'Mobile money.';
}

/** Shown when the message names neither a person nor a merchant. */
export function fallbackCounterparty(kind: string): string {
  return FALLBACK_NAMES[kind] ?? 'MoMo payment';
}

const two = (n: number) => String(n).padStart(2, '0');

/** `Tue 20 Oct · 12:41`, with the year when it is not the current one and "about" when the time is the SMS received time. */
export function occurredAtLabel(ms: number, approximate: boolean, today: Date): string {
  const date = new Date(ms);
  const day = shortDate(isoDate(date));
  const year = date.getUTCFullYear();
  const time = `${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
  return `${year === today.getUTCFullYear() ? day : `${day} ${year}`} · ${approximate ? 'about ' : ''}${time}`;
}

/** `Today`, `Yesterday`, else `Mon 19 Oct`. */
export function relativeDay(iso: string, today: Date): string {
  if (dayState(iso, today) === 'today') return 'Today';
  const yesterday = isoDate(new Date(Date.parse(`${isoDate(today)}T00:00:00Z`) - 86_400_000));
  return iso === yesterday ? 'Yesterday' : shortDate(iso);
}

/** Day heading in the Transactions list: `Today · Tue 20 Oct`, `Yesterday · Mon 19 Oct`, else `Sun 18 Oct`. */
export function dayHeading(iso: string, today: Date): string {
  const relative = relativeDay(iso, today);
  return relative === shortDate(iso) ? relative : `${relative} · ${shortDate(iso)}`;
}
