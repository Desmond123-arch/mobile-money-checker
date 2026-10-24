import { getImportState, resetImportState, setImportState } from '@/backup/importStore';
import type { Db } from '@/data/db';
import { getMeta } from '@/data/meta';
import { importSummary } from '@/ledger/importSummary';
import { createScanner } from '@/scan/scan';
import type { ScanOutcome, SmsSource } from '@/scan/types';

export interface ScanController {
  /**
   * Every trigger goes through here. Before the first import finishes it reports through the
   * import store, so Importing shows real progress; afterwards it is silent.
   */
  scan(): Promise<ScanOutcome>;
  /** The first scan, behind the Importing screen. The store is set before the first await. */
  scanFirst(): Promise<ScanOutcome>;
}

export function createScanController(deps: {
  db: Db;
  sms: SmsSource;
  /** Called when a silent scan changed stored data, so cached queries are refreshed. */
  onChanged: () => void;
  now?: () => number;
}): ScanController {
  const { db, sms, onChanged, now } = deps;
  let announcing = false;
  const scanner = createScanner({
    db,
    sms,
    ...(now ? { now } : {}),
    onProgress: (p) => {
      if (announcing) setImportState(p);
    },
  });

  async function scanFirst(): Promise<ScanOutcome> {
    const state = getImportState();
    if (!(state.phase === 'running' && state.kind === 'scan')) {
      resetImportState();
      setImportState({ phase: 'running', kind: 'scan' });
    }
    announcing = true;
    const outcome = await scanner.scan();
    announcing = false;
    switch (outcome.status) {
      case 'ok': {
        const summary = await importSummary(db);
        setImportState({ phase: 'done', summary, total: outcome.read, read: outcome.read });
        break;
      }
      case 'no_messages':
        setImportState({ phase: 'done', empty: true });
        break;
      default:
        setImportState({ phase: 'failed' });
    }
    return outcome;
  }

  async function scan(): Promise<ScanOutcome> {
    const done = (await getMeta(db, 'first_import_done').catch(() => null)) === '1';
    if (!done) {
      // Without access there is nothing to announce, so leave the import store alone.
      const permission = await sms.getPermissionStatus().catch(() => null);
      if (permission === null) return { status: 'failed' };
      if (permission !== 'granted') return { status: 'no_permission', permission };
      return scanFirst();
    }
    const outcome = await scanner.scan();
    if (outcome.status === 'ok' && outcome.changed) onChanged();
    return outcome;
  }

  return { scan, scanFirst };
}
