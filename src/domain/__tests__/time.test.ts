import { parseBodyTime, resolveOccurredAt } from '../time';

describe('parseBodyTime', () => {
  it.each([
    ['2024-04-13 15:46:23', Date.UTC(2024, 3, 13, 15, 46, 23)],
    ['2024-04-13T15:46:23', Date.UTC(2024, 3, 13, 15, 46, 23)],
    ['  2025-12-31 23:59:59 ', Date.UTC(2025, 11, 31, 23, 59, 59)],
    ['2024-02-29 00:00:00', Date.UTC(2024, 1, 29)],
  ])('parses %j', (text, expected) => {
    expect(parseBodyTime(text)).toBe(expected);
  });

  it.each([
    [''],
    ['202408131727'],
    ['2024-13-01 00:00:00'],
    ['2024-02-30 10:00:00'],
    ['2023-02-29 10:00:00'],
    ['2024-04-13 25:00:00'],
    ['2024-04-13 10:30:60'],
    ['2024-04-13 10:60:00'],
    ['2024-04-13'],
    ['13/04/2024 15:46:23'],
  ])('rejects %j', (text) => {
    expect(parseBodyTime(text)).toBeNull();
  });
});

describe('resolveOccurredAt', () => {
  const received = Date.UTC(2024, 3, 13, 16, 0, 0);

  it('prefers a body time', () => {
    expect(resolveOccurredAt('2024-04-13 15:46:23', received)).toEqual({
      at: Date.UTC(2024, 3, 13, 15, 46, 23),
      source: 'body',
    });
  });

  it.each([[null], ['202408131727'], ['garbage']])('falls back to received time for %j', (text) => {
    expect(resolveOccurredAt(text, received)).toEqual({ at: received, source: 'received' });
  });
});
