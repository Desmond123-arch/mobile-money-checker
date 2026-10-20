import { pesewas } from '../money';
import { dailyAverage } from '../summary/month';

describe('dailyAverage', () => {
  it('divides the spend by the days elapsed, rounded to a pesewa', () => {
    expect(dailyAverage(pesewas(124050), 20)).toBe(6203);
    expect(dailyAverage(pesewas(10000), 3)).toBe(3333);
  });

  it('is zero before any day has passed', () => {
    expect(dailyAverage(pesewas(5000), 0)).toBe(0);
  });
});
