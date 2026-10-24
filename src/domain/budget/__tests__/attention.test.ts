import { progressOf } from '../progress';
import { attentionLine, attentionOf } from '../attention';

const line = (categoryId: string, limit: number, spent: number) => ({
  categoryId,
  progress: progressOf(limit, spent),
});

describe('attentionOf', () => {
  it('is null when every limit is comfortable', () => {
    expect(attentionOf([])).toBeNull();
    expect(attentionOf([line('food', 1_000, 100), line('transport', 1_000, 790)])).toBeNull();
  });

  it('names the category furthest over, ahead of one that is only close', () => {
    expect(
      attentionOf([
        line('food', 1_000, 1_200),
        line('transport', 1_000, 1_500),
        line('health', 1_000, 900),
      ]),
    ).toEqual({ categoryId: 'transport', tone: 'over', amount: 500 });
  });

  it('breaks a tie by id so the answer is stable', () => {
    expect(attentionOf([line('b', 1_000, 1_100), line('a', 1_000, 1_100)])?.categoryId).toBe('a');
  });

  it('falls back to the closest limit from 80% of it', () => {
    expect(
      attentionOf([
        line('food', 1_000, 800),
        line('transport', 1_000, 950),
        line('health', 1_000, 10),
      ]),
    ).toEqual({ categoryId: 'transport', tone: 'watch', amount: 50 });
    expect(attentionOf([line('b', 1_000, 900), line('a', 1_000, 900)])?.categoryId).toBe('a');
  });

  it('counts a limit that is exactly used as close, not over', () => {
    expect(attentionOf([line('food', 1_000, 1_000)])).toEqual({
      categoryId: 'food',
      tone: 'watch',
      amount: 0,
    });
  });
});

describe('attentionLine', () => {
  it('says over or left in plain words', () => {
    expect(attentionLine({ categoryId: 'food', tone: 'over', amount: 1_200 }, 'Food')).toBe(
      'Food is over by GHS 12.00.',
    );
    expect(attentionLine({ categoryId: 'food', tone: 'watch', amount: 4_000 }, 'Food')).toBe(
      'Food has GHS 40.00 left.',
    );
  });
});
