import { allocate, categoryShares } from '../category/share';
import { pesewas } from '../money';

describe('categoryShares', () => {
  it('sorts largest first and rounds percentages to whole numbers', () => {
    const shares = categoryShares([
      { categoryId: 'rent', amount: pesewas(22000) },
      { categoryId: 'food', amount: pesewas(41200) },
      { categoryId: 'other', amount: pesewas(9200) },
    ]);
    expect(shares.map((s) => s.categoryId)).toEqual(['food', 'rent', 'other']);
    expect(shares.map((s) => s.percent)).toEqual([57, 30, 13]);
  });

  it('returns nothing when there is no spend', () => {
    expect(categoryShares([])).toEqual([]);
    expect(categoryShares([{ categoryId: 'food', amount: pesewas(0) }])).toEqual([]);
  });
});

describe('allocate', () => {
  it('splits a total by weight and always sums to the total', () => {
    const parts = allocate(pesewas(10000), { food: 1, rent: 1, other: 1 });
    expect(parts.reduce((sum, p) => sum + p.amount, 0)).toBe(10000);
    expect(parts.map((p) => p.amount).sort()).toEqual([3333, 3333, 3334]);
  });

  it('keeps proportions for uneven weights', () => {
    const parts = allocate(pesewas(10000), { food: 3, rent: 1 });
    expect(parts).toEqual([
      { categoryId: 'food', amount: 7500 },
      { categoryId: 'rent', amount: 2500 },
    ]);
  });

  it('ignores zero weights and returns nothing for an empty total', () => {
    expect(allocate(pesewas(500), { food: 0, rent: 2 })).toEqual([
      { categoryId: 'rent', amount: 500 },
    ]);
    expect(allocate(pesewas(0), { food: 1 })).toEqual([]);
    expect(allocate(pesewas(500), {})).toEqual([]);
  });
});
