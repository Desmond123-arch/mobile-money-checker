import { setup } from '@/data/__tests__/fixtures';
import { getMeta } from '@/data/meta';
import { finishImport } from '@/ledger/finishImport';

import { IMPORT_ROW_HINT, importRowSubtitle } from '../importRowSubtitle';

describe('importRowSubtitle', () => {
  it('shows the hint before any import', () => {
    expect(importRowSubtitle(null)).toBe(IMPORT_ROW_HINT);
    expect(importRowSubtitle('garbage')).toBe(IMPORT_ROW_HINT);
  });

  it('shows the date after an import', () => {
    expect(importRowSubtitle(String(Date.UTC(2026, 5, 21, 0, 28)))).toBe(
      'Last imported 21 Jun 2026',
    );
  });
});

describe('last_import_at', () => {
  it('moves on every import while first_import_at stays', async () => {
    const db = await setup();
    await finishImport(db, Date.UTC(2026, 5, 21));
    await finishImport(db, Date.UTC(2026, 8, 1));
    expect(await getMeta(db, 'first_import_at')).toBe(String(Date.UTC(2026, 5, 21)));
    expect(await getMeta(db, 'last_import_at')).toBe(String(Date.UTC(2026, 8, 1)));
  });
});
