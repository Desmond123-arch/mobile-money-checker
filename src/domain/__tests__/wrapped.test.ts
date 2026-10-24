import { formatGhs, pesewas, type Pesewas } from '../money';
import {
  buildWrapped,
  hasWrapped,
  toneOn,
  type WrappedFacts,
  type WrappedSlide,
} from '../summary/wrapped';

const p = (n: number) => pesewas(n);
const month = (monthId: string, out: number, inn = 0) => ({ monthId, out: p(out), in: p(inn) });
const week = (...v: number[]): Pesewas[] => Array.from({ length: 7 }, (_, i) => p(v[i] ?? 0));

const food = { id: 'food', name: 'Food', color: '#2A78D6', amount: p(60000) };
const rent = { id: 'rent', name: 'Rent & Bills', color: '#EB6834', amount: p(40000) };

function facts(over: Partial<WrappedFacts> = {}): WrappedFacts {
  return {
    scope: { kind: 'year', year: 2025 },
    spent: p(100000),
    moneyIn: p(250000),
    payments: 12,
    months: [month('2025-01', 30000, 250000), month('2025-02', 70000)],
    categories: [rent, food],
    biggest: { amount: p(45000), who: 'Ama Store', iso: '2025-02-03' },
    topBySpend: { name: 'Ama Store', spent: p(52000), count: 3 },
    topByCount: { name: 'Kofi Fruits', spent: p(1200), count: 6 },
    weekdays: week(0, 0, 0, 0, 0, 80000, 20000),
    days: { span: 40, active: 10 },
    ...over,
  };
}

const kinds = (slides: WrappedSlide[]) => slides.map((s) => s.kind);
const text = (s: WrappedSlide) => `${s.label} ${s.line}`;
const find = <K extends WrappedSlide['kind']>(slides: WrappedSlide[], kind: K) =>
  slides.find((s): s is Extract<WrappedSlide, { kind: K }> => s.kind === kind);

describe('buildWrapped', () => {
  it('builds every slide, in order, for a full year', () => {
    expect(kinds(buildWrapped(facts()))).toEqual([
      'intro',
      'total',
      'category',
      'biggest',
      'person',
      'busiest',
      'daily',
      'closing',
    ]);
  });

  it.each([
    ['no payments', { payments: 0 }],
    ['nothing spent', { spent: p(0) }],
    ['fully refunded', { spent: p(0), payments: 2 }],
  ])('gives no slides for %s', (_name, over) => {
    expect(buildWrapped(facts(over))).toEqual([]);
    expect(hasWrapped(facts(over))).toBe(false);
  });

  it('writes the year intro and the all-time intro with its span', () => {
    const year = find(buildWrapped(facts()), 'intro');
    expect(year?.big.text).toBe('Your 2025, wrapped');
    const all = find(
      buildWrapped(
        facts({
          scope: { kind: 'all' },
          months: [month('2024-04', 100), month('2024-05', 0, 5), month('2026-06', 200)],
        }),
      ),
      'intro',
    );
    expect(all?.big.text).toBe('Your whole MoMo story');
    expect(all?.label).toBe('Apr 2024 to Jun 2026');
  });

  it('falls back to a plain intro label with no months', () => {
    const all = find(buildWrapped(facts({ scope: { kind: 'all' }, months: [] })), 'intro');
    expect(all?.label).toBe('MoMo Spend');
  });

  it('totals the spend and mentions money in only when there was some', () => {
    const total = find(buildWrapped(facts()), 'total');
    expect(total?.big.amount).toBe(100000);
    expect(total?.line).toBe('That was 12 payments. GHS 2,500.00 came in.');
    const none = find(buildWrapped(facts({ moneyIn: p(0), payments: 1 })), 'total');
    expect(none?.line).toBe('That was 1 payment.');
    const all = find(buildWrapped(facts({ scope: { kind: 'all' } })), 'total');
    expect(all?.label).toBe('You spent in all');
  });

  it('names the top category with its share and colour', () => {
    const c = find(buildWrapped(facts()), 'category');
    expect(c).toMatchObject({ categoryId: 'food', big: { value: 60 } });
    expect(c?.tone).toEqual({ bg: '#2A78D6', fg: '#FFFFFF' });
    expect(c?.line).toBe('Food took GHS 600.00 of your GHS 1,000.00.');
  });

  it('says everything when one category has it all, and skips the slide with none', () => {
    const one = buildWrapped(facts({ categories: [{ ...food, amount: p(100000) }] }));
    expect(find(one, 'category')?.line).toBe('Everything went on Food, GHS 1,000.00.');
    expect(kinds(buildWrapped(facts({ categories: [] })))).not.toContain('category');
  });

  it('reads biggest-payment copy for named, unnamed and only payments', () => {
    const line = (over: Partial<WrappedFacts>) => find(buildWrapped(facts(over)), 'biggest')?.line;
    expect(line({})).toBe('That went to Ama Store on 3 Feb 2025.');
    expect(line({ biggest: { amount: p(5), who: null, iso: '2025-02-03' } })).toBe(
      'That was on 3 Feb 2025.',
    );
    expect(line({ payments: 1 })).toBe('Your one payment, to Ama Store, on 3 Feb 2025.');
    expect(line({ payments: 1, biggest: { amount: p(5), who: null, iso: '2025-12-31' } })).toBe(
      'Your one payment, on 31 Dec 2025.',
    );
    expect(kinds(buildWrapped(facts({ biggest: null })))).not.toContain('biggest');
  });

  it('names who was paid most, by spend and by count', () => {
    const person = find(buildWrapped(facts()), 'person');
    expect(person?.big.amount).toBe(52000);
    expect(person?.line).toBe(
      'Ama Store got the most, from 3 payments. Kofi Fruits got the most payments, 6.',
    );
    const same = find(
      buildWrapped(facts({ topByCount: { name: 'Ama Store', spent: p(52000), count: 3 } })),
      'person',
    );
    expect(same?.line).toBe(
      'Ama Store got the most, from 3 payments. That was also the most payments to anyone.',
    );
    const single = find(
      buildWrapped(
        facts({ topBySpend: { name: 'Ama', spent: p(900), count: 1 }, topByCount: null }),
      ),
      'person',
    );
    expect(single?.line).toBe('Ama got the most, from 1 payment.');
    expect(kinds(buildWrapped(facts({ topBySpend: null })))).not.toContain('person');
  });

  describe('busiest', () => {
    it('picks the biggest month and the busiest weekday in a year', () => {
      const s = find(buildWrapped(facts()), 'busiest');
      expect(s?.label).toBe('Your busiest month');
      expect(s?.big.text).toBe('February');
      expect(s?.line).toBe(
        'GHS 700.00 went out in February 2025. Fridays were your busiest day of the week, GHS 800.00 in all.',
      );
    });

    it('breaks a tie between months towards the earlier one', () => {
      const s = find(
        buildWrapped(facts({ months: [month('2025-05', 500), month('2025-03', 500)] })),
        'busiest',
      );
      expect(s?.big.text).toBe('March');
    });

    it('breaks a tie between weekdays towards the earlier one in a Monday-first week', () => {
      const s = find(buildWrapped(facts({ weekdays: week(500, 500, 500) })), 'busiest');
      expect(s?.line).toContain('Mondays were your busiest');
      const sunday = find(buildWrapped(facts({ weekdays: week(900) })), 'busiest');
      expect(sunday?.line).toContain('Sundays were your busiest');
    });

    it('handles a single month by saying all of it was there', () => {
      const s = find(buildWrapped(facts({ months: [month('2025-03', 100000)] })), 'busiest');
      expect(s?.line).toMatch(/^All of your spending was in March 2025, GHS 1,000.00\./);
    });

    it('drops the weekday sentence when no weekday has spend, and the slide with no month', () => {
      const s = find(buildWrapped(facts({ weekdays: week() })), 'busiest');
      expect(s?.line).not.toContain('busiest day');
      expect(kinds(buildWrapped(facts({ months: [month('2025-03', 0, 5)] })))).not.toContain(
        'busiest',
      );
    });

    it('picks the busiest year for all time', () => {
      const s = find(
        buildWrapped(
          facts({
            scope: { kind: 'all' },
            months: [month('2024-04', 100), month('2025-06', 900), month('2025-07', 400)],
          }),
        ),
        'busiest',
      );
      expect(s?.label).toBe('Your busiest year');
      expect(s?.big.text).toBe('2025');
      expect(s?.line).toContain(
        'GHS 13.00 went out in 2025. June 2025 was the biggest month, GHS 9.00.',
      );
    });

    it('falls back to the busiest month when all time is one year', () => {
      const s = find(
        buildWrapped(
          facts({ scope: { kind: 'all' }, months: [month('2025-06', 900), month('2025-07', 400)] }),
        ),
        'busiest',
      );
      expect(s?.label).toBe('Your busiest month');
      expect(s?.big.text).toBe('June 2025');
    });
  });

  describe('daily', () => {
    const daily = (days: { span: number; active: number }) =>
      find(buildWrapped(facts({ days })), 'daily');

    it('averages over the span and counts the no-spend days', () => {
      const s = daily({ span: 40, active: 10 });
      expect(s?.big.amount).toBe(2500);
      expect(s?.line).toBe('30 of 40 days had no spending at all.');
    });

    it('uses singular for one day and says so when every day had spending', () => {
      expect(daily({ span: 1, active: 1 })?.line).toBe('All of it happened on a single day.');
      expect(daily({ span: 7, active: 7 })?.line).toBe(
        'You spent something on every one of 7 days.',
      );
      expect(daily({ span: 2, active: 1 })?.line).toBe('1 of 2 days had no spending at all.');
    });

    it('rounds the average to whole pesewas and skips an empty span', () => {
      expect(
        find(buildWrapped(facts({ spent: p(100), days: { span: 3, active: 3 } })), 'daily')?.big
          .amount,
      ).toBe(33);
      expect(daily({ span: 0, active: 0 })).toBeUndefined();
    });
  });

  describe('closing', () => {
    it('sums the year up in one line with the privacy note', () => {
      const s = find(buildWrapped(facts()), 'closing');
      expect(s?.label).toBe('That is your year in one line');
      expect(s?.line).toBe('12 payments, led by Food. Busiest in February 2025.');
      expect(s?.footnote).toMatch(/stay on this phone/);
    });

    it('words the all-time version and copes with one payment and no category', () => {
      const s = find(
        buildWrapped(facts({ scope: { kind: 'all' }, payments: 1, categories: [], months: [] })),
        'closing',
      );
      expect(s?.label).toBe('That is your story in one line');
      expect(s?.line).toBe('1 payment.');
    });
  });

  it('handles a single payment in a single month', () => {
    const slides = buildWrapped(
      facts({
        payments: 1,
        spent: p(1500),
        moneyIn: p(0),
        months: [month('2025-09', 1500)],
        categories: [{ ...food, amount: p(1500) }],
        biggest: { amount: p(1500), who: 'Ama', iso: '2025-09-09' },
        topBySpend: { name: 'Ama', spent: p(1500), count: 1 },
        topByCount: { name: 'Ama', spent: p(1500), count: 1 },
        weekdays: week(0, 1500),
        days: { span: 1, active: 1 },
      }),
    );
    expect(slides).toHaveLength(8);
    expect(slides.map(text).join(' ')).not.toMatch(/\b1 payments\b|\b1 days\b/);
  });
});

describe('slide text matches its inputs', () => {
  const cases: [string, WrappedFacts][] = [
    ['year', facts()],
    [
      'all time',
      facts({
        scope: { kind: 'all' },
        spent: p(123456),
        payments: 77,
        months: [month('2024-04', 23456), month('2025-06', 90000), month('2026-01', 10000, 5)],
        days: { span: 600, active: 61 },
      }),
    ],
  ];

  const tokens = (s: string) => s.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];

  it.each(cases)('uses only numbers from the %s facts', (_name, f) => {
    const allowed = new Set<string>();
    const money = (n: number) => formatGhs(p(n)).replace('GHS ', '');
    const add = (...v: (string | number)[]) => v.forEach((x) => allowed.add(String(x)));
    add(money(f.spent), money(f.moneyIn), f.payments, f.days.span, f.days.span - f.days.active);
    add(money(Math.round(f.spent / f.days.span)));
    for (const m of f.months) add(money(m.out), m.monthId.slice(0, 4));
    for (const c of f.categories) add(money(c.amount), Math.round((c.amount * 100) / f.spent));
    for (const w of f.weekdays) add(money(w));
    if (f.biggest) {
      add(money(f.biggest.amount), f.biggest.iso.slice(0, 4), Number(f.biggest.iso.slice(8)));
    }
    for (const n of [f.topBySpend, f.topByCount]) if (n) add(money(n.spent), n.count);
    const years = new Map<number, number>();
    for (const m of f.months) {
      const y = Number(m.monthId.slice(0, 4));
      years.set(y, (years.get(y) ?? 0) + m.out);
    }
    for (const [y, out] of years) add(y, money(out));
    if (f.scope.kind === 'year') add(f.scope.year);

    for (const slide of buildWrapped(f)) {
      const shown = [slide.label, slide.line, slide.big.kind === 'text' ? slide.big.text : ''];
      for (const t of shown.flatMap(tokens)) {
        expect([t, allowed.has(t)]).toEqual([t, true]);
      }
      if (slide.big.kind === 'money') expect(allowed).toContain(money(slide.big.amount));
    }
  });
});

describe('toneOn', () => {
  it.each([
    ['#14110F', '#FFFFFF'],
    ['#F5B800', '#14110F'],
    ['#EDA100', '#14110F'],
    ['#6250D6', '#FFFFFF'],
    ['#9A9A9A', '#14110F'],
  ])('reads %s with %s', (bg, fg) => {
    expect(toneOn(bg)).toEqual({ bg, fg });
  });
});
