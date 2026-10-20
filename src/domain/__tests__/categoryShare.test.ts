import { categoryShares } from '../category/share';
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
