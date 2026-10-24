import { monthLabel, monthName } from '../calendar/month';
import { categoryShares } from '../category/share';
import { formatGhs, pesewas, type Pesewas } from '../money';
import { biggestMonth, type MonthFlow } from './trend';
import { spanLabel, yearFlowsOf } from './year';

export type WrappedScope = { kind: 'year'; year: number } | { kind: 'all' };

export interface WrappedCategory {
  id: string;
  name: string;
  color: string;
  amount: Pesewas;
}

/** A person or place paid, by net money out and by number of payments. */
export interface NamedSpend {
  name: string;
  spent: Pesewas;
  count: number;
}

export interface BiggestPayment {
  amount: Pesewas;
  /** Null when the payment carries no name; the slide then leaves the "to ..." out. */
  who: string | null;
  /** UTC date, `YYYY-MM-DD`. */
  iso: string;
}

/**
 * Everything `buildWrapped` needs, read from the ledger by the data layer. All money is net of
 * refunds and matches the Insights year and all-time numbers. The slides only format and compare
 * these values; they never compute a figure the Insights screen would not show.
 */
export interface WrappedFacts {
  scope: WrappedScope;
  spent: Pesewas;
  moneyIn: Pesewas;
  payments: number;
  /** Money out and in per month in scope; months with no data may be left out or be zero. */
  months: readonly MonthFlow[];
  /** Categories with net spend above zero, in any order. */
  categories: readonly WrappedCategory[];
  biggest: BiggestPayment | null;
  topBySpend: NamedSpend | null;
  topByCount: NamedSpend | null;
  /** Net spend per weekday, index 0 = Sunday. */
  weekdays: readonly Pesewas[];
  /** `span` is the days from the first to the last day with spending, both included. */
  days: { span: number; active: number };
}

export interface Tone {
  bg: string;
  fg: string;
}

export type WrappedBig =
  | { kind: 'text'; text: string }
  | { kind: 'money'; amount: Pesewas }
  | { kind: 'percent'; value: number };

interface Base {
  tone: Tone;
  label: string;
  line: string;
}

export type WrappedSlide =
  | (Base & { kind: 'intro'; big: { kind: 'text'; text: string } })
  | (Base & { kind: 'total'; big: { kind: 'money'; amount: Pesewas } })
  | (Base & { kind: 'category'; categoryId: string; big: { kind: 'percent'; value: number } })
  | (Base & { kind: 'biggest'; big: { kind: 'money'; amount: Pesewas } })
  | (Base & { kind: 'person'; big: { kind: 'money'; amount: Pesewas } })
  | (Base & { kind: 'busiest'; big: { kind: 'text'; text: string } })
  | (Base & { kind: 'daily'; big: { kind: 'money'; amount: Pesewas } })
  | (Base & { kind: 'closing'; big: { kind: 'money'; amount: Pesewas }; footnote: string });

export type WrappedKind = WrappedSlide['kind'];

export const INK = '#14110F';
export const SIGNAL = '#F5B800';
export const GROUND = '#FFFFFF';

const INK_TONE: Tone = { bg: INK, fg: GROUND };
const SIGNAL_TONE: Tone = { bg: SIGNAL, fg: INK };
const GROUND_TONE: Tone = { bg: GROUND, fg: INK };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Ties on the busiest weekday go to the earliest in a Monday-first week. */
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Ink or white, whichever reads better on `bg` (a `#RRGGBB` colour). */
export function toneOn(bg: string): Tone {
  const channel = (i: number) => {
    const c = parseInt(bg.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return { bg, fg: luminance > 0.3 ? INK : GROUND };
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const dateLabel = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${monthName(iso.slice(0, 7)).slice(0, 3)} ${iso.slice(0, 4)}`;

const byMonth = (a: MonthFlow, b: MonthFlow) => (a.monthId < b.monthId ? -1 : 1);

/** Whether there is anything to recap: money went out in the scope. */
export const hasWrapped = (facts: Pick<WrappedFacts, 'payments' | 'spent'>): boolean =>
  facts.payments > 0 && facts.spent > 0;

/** The slides for a scope, in order. A slide whose data is missing is left out; no data gives none. */
export function buildWrapped(facts: WrappedFacts): WrappedSlide[] {
  if (!hasWrapped(facts)) return [];
  const slides: (WrappedSlide | null)[] = [
    intro(facts),
    total(facts),
    category(facts),
    biggest(facts),
    person(facts),
    busiest(facts),
    daily(facts),
    closing(facts),
  ];
  return slides.filter((s): s is WrappedSlide => s !== null);
}

function topCategory(f: WrappedFacts) {
  const top = categoryShares(f.categories.map((c) => ({ categoryId: c.id, amount: c.amount })))[0];
  const meta = f.categories.find((c) => c.id === top?.categoryId);
  return top && meta ? { percent: top.percent, meta } : null;
}

function intro(f: WrappedFacts): WrappedSlide {
  if (f.scope.kind === 'year') {
    return {
      kind: 'intro',
      tone: INK_TONE,
      label: 'MoMo Spend',
      big: { kind: 'text', text: `Your ${f.scope.year}, wrapped` },
      line: `Here is how ${f.scope.year} went, one payment at a time.`,
    };
  }
  const active = f.months.filter((m) => m.out > 0 || m.in > 0).sort(byMonth);
  const first = active[0];
  const last = active.at(-1);
  return {
    kind: 'intro',
    tone: INK_TONE,
    label: first && last ? spanLabel(first.monthId, last.monthId) : 'MoMo Spend',
    big: { kind: 'text', text: 'Your whole MoMo story' },
    line: 'Everything since your first payment, in a few taps.',
  };
}

function total(f: WrappedFacts): WrappedSlide {
  const came = f.moneyIn > 0 ? ` ${formatGhs(f.moneyIn)} came in.` : '';
  return {
    kind: 'total',
    tone: SIGNAL_TONE,
    label: f.scope.kind === 'year' ? `You spent in ${f.scope.year}` : 'You spent in all',
    big: { kind: 'money', amount: f.spent },
    line: `That was ${plural(f.payments, 'payment')}.${came}`,
  };
}

function category(f: WrappedFacts): WrappedSlide | null {
  const top = topCategory(f);
  if (!top) return null;
  const { meta, percent } = top;
  const line =
    percent >= 100
      ? `Everything went on ${meta.name}, ${formatGhs(meta.amount)}.`
      : `${meta.name} took ${formatGhs(meta.amount)} of your ${formatGhs(f.spent)}.`;
  return {
    kind: 'category',
    categoryId: meta.id,
    tone: toneOn(meta.color),
    label: 'Your top category',
    big: { kind: 'percent', value: percent },
    line,
  };
}

function biggest(f: WrappedFacts): WrappedSlide | null {
  const b = f.biggest;
  if (!b) return null;
  const when = dateLabel(b.iso);
  const to = b.who ? `, to ${b.who},` : ',';
  const line =
    f.payments === 1
      ? `Your one payment${to} on ${when}.`
      : b.who
        ? `That went to ${b.who} on ${when}.`
        : `That was on ${when}.`;
  return {
    kind: 'biggest',
    tone: GROUND_TONE,
    label: 'Your biggest payment',
    big: { kind: 'money', amount: b.amount },
    line,
  };
}

function person(f: WrappedFacts): WrappedSlide | null {
  const spend = f.topBySpend;
  if (!spend) return null;
  let line = `${spend.name} got the most, from ${plural(spend.count, 'payment')}.`;
  const count = f.topByCount;
  if (count) {
    line +=
      count.name === spend.name
        ? ' That was also the most payments to anyone.'
        : ` ${count.name} got the most payments, ${count.count}.`;
  }
  return {
    kind: 'person',
    tone: INK_TONE,
    label: 'The one you paid most',
    big: { kind: 'money', amount: spend.spent },
    line,
  };
}

function busiestWeekday(weekdays: readonly Pesewas[]): string | null {
  let best: number | null = null;
  for (const d of MONDAY_FIRST) {
    const amount = weekdays[d] ?? 0;
    if (amount > 0 && (best === null || amount > (weekdays[best] ?? 0))) best = d;
  }
  if (best === null) return null;
  return `${WEEKDAYS[best]}s were your busiest day of the week, ${formatGhs(pesewas(weekdays[best] ?? 0))} in all.`;
}

function busiest(f: WrappedFacts): WrappedSlide | null {
  const months = f.months.filter((m) => m.out > 0).sort(byMonth);
  const topMonth = biggestMonth(months);
  if (!topMonth) return null;

  const years = yearFlowsOf(months);
  const topYear =
    f.scope.kind === 'all' && years.length > 1
      ? years.reduce((best, y) => (y.out > best.out ? y : best))
      : null;

  let label: string;
  let text: string;
  let head: string;
  if (topYear) {
    label = 'Your busiest year';
    text = String(topYear.year);
    head = `${formatGhs(topYear.out)} went out in ${topYear.year}. ${monthLabel(topMonth.monthId)} was the biggest month, ${formatGhs(topMonth.out)}.`;
  } else {
    label = 'Your busiest month';
    text = f.scope.kind === 'all' ? monthLabel(topMonth.monthId) : monthName(topMonth.monthId);
    head =
      months.length === 1
        ? `All of your spending was in ${monthLabel(topMonth.monthId)}, ${formatGhs(topMonth.out)}.`
        : `${formatGhs(topMonth.out)} went out in ${monthLabel(topMonth.monthId)}.`;
  }
  const weekday = busiestWeekday(f.weekdays);
  return {
    kind: 'busiest',
    tone: SIGNAL_TONE,
    label,
    big: { kind: 'text', text },
    line: weekday ? `${head} ${weekday}` : head,
  };
}

function daily(f: WrappedFacts): WrappedSlide | null {
  const { span, active } = f.days;
  if (span <= 0) return null;
  const quiet = span - active;
  const line =
    span === 1
      ? 'All of it happened on a single day.'
      : quiet === 0
        ? `You spent something on every one of ${span} days.`
        : `${quiet} of ${plural(span, 'day')} had no spending at all.`;
  return {
    kind: 'daily',
    tone: GROUND_TONE,
    label: 'A day, on average',
    big: { kind: 'money', amount: pesewas(Math.round(f.spent / span)) },
    line,
  };
}

function closing(f: WrappedFacts): WrappedSlide {
  const top = topCategory(f);
  const topMonth = biggestMonth(f.months.filter((m) => m.out > 0).sort(byMonth));
  const parts = [plural(f.payments, 'payment')];
  if (top) parts.push(`led by ${top.meta.name}`);
  let line = `${parts.join(', ')}.`;
  if (topMonth) line += ` Busiest in ${monthLabel(topMonth.monthId)}.`;
  return {
    kind: 'closing',
    tone: INK_TONE,
    label:
      f.scope.kind === 'year' ? 'That is your year in one line' : 'That is your story in one line',
    big: { kind: 'money', amount: f.spent },
    line,
    footnote: 'The names you saw stay on this phone. Nothing here was sent anywhere.',
  };
}
