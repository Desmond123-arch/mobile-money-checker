import { CATEGORY_SWATCHES, SEED_CATEGORIES } from '../category/seed';

const HEX = /^#[0-9A-F]{6}$/;

describe('seed categories', () => {
  it('has unique ids and names', () => {
    expect(new Set(SEED_CATEGORIES.map((c) => c.id)).size).toBe(SEED_CATEGORIES.length);
    expect(new Set(SEED_CATEGORIES.map((c) => c.name)).size).toBe(SEED_CATEGORIES.length);
  });

  it('gives every category a solid and a tint colour', () => {
    for (const c of SEED_CATEGORIES) {
      expect(c.color).toMatch(HEX);
      expect(c.tint).toMatch(HEX);
    }
  });

  it('offers swatches that are all valid colours', () => {
    for (const swatch of CATEGORY_SWATCHES) expect(swatch).toMatch(HEX);
  });
});
