import { QueryClient } from '@tanstack/react-query';

import { MONEY_KEYS, SETTINGS_KEYS, invalidateGroups, splitGroups } from '../writeGroups';

describe('splitGroups', () => {
  it('waits for settings and refreshes money behind the save', () => {
    expect(splitGroups(['money', 'settings'])).toEqual({
      wait: ['settings'],
      background: ['money'],
    });
  });

  it('has nothing to wait for when only money changed', () => {
    expect(splitGroups(['money'])).toEqual({ wait: [], background: ['money'] });
  });

  it('has nothing at all to refresh when nothing changed', () => {
    expect(splitGroups([])).toEqual({ wait: [], background: [] });
  });
});

describe('invalidateGroups', () => {
  it('marks only the named prefixes stale', async () => {
    const client = new QueryClient();
    client.setQueryData(['summary', 'x'], 1);
    client.setQueryData(['categories'], 2);
    await invalidateGroups(client, ['settings']);
    expect(client.getQueryState(['categories'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['summary', 'x'])?.isInvalidated).toBe(false);
    await invalidateGroups(client, []);
  });

  it('covers every money prefix, including budgets', () => {
    expect(MONEY_KEYS).toContain('budget');
    expect(SETTINGS_KEYS).toContain('names');
  });
});
