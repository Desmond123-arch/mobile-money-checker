import { allocationProblem, amountLeft, startOfUtcDay } from '../cash/allocation';

const DAY = 86_400_000;
const OUT = Date.UTC(2024, 4, 10, 15);
const NOW = Date.UTC(2024, 4, 12, 9);
const ctx = { room: 5_000, cashOutAt: OUT, now: NOW };
const ok = { categoryId: 'food', amount: 1_000, spentOn: OUT };

describe('amountLeft', () => {
  it('subtracts and never goes below zero', () => {
    expect(amountLeft(10_000, 2_500)).toBe(7_500);
    expect(amountLeft(1_000, 4_000)).toBe(0);
  });
});

describe('startOfUtcDay', () => {
  it('drops the time of day', () => {
    expect(startOfUtcDay(OUT)).toBe(Date.UTC(2024, 4, 10));
  });
});

describe('allocationProblem', () => {
  it('accepts a good draft, including the first and the last allowed day', () => {
    expect(allocationProblem(ok, ctx)).toBeNull();
    expect(allocationProblem({ ...ok, amount: 5_000, spentOn: NOW }, ctx)).toBeNull();
  });

  it.each([null, ''])('wants a category (%p)', (categoryId) => {
    expect(allocationProblem({ ...ok, categoryId }, ctx)).toBe('Pick a category.');
  });

  it.each([null, 0, -5, 10.5])('wants an amount above zero (%p)', (amount) => {
    expect(allocationProblem({ ...ok, amount }, ctx)).toBe('Amount must be more than 0.');
  });

  it('says what is left when the amount is too big', () => {
    expect(allocationProblem({ ...ok, amount: 5_001 }, ctx)).toBe(
      'That is more than what is left (GHS 50.00).',
    );
    expect(allocationProblem(ok, { ...ctx, room: 0 })).toBe('Nothing is left to break down.');
  });

  it('keeps the day between the withdrawal and today', () => {
    expect(allocationProblem({ ...ok, spentOn: OUT - DAY }, ctx)).toBe(
      'Pick a day on or after the withdrawal.',
    );
    expect(allocationProblem({ ...ok, spentOn: NOW + DAY }, ctx)).toBe(
      'That day has not come yet.',
    );
  });
});
