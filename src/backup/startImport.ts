import type { ImportSummary } from '@/ledger/importSummary';

import { openExpoFile } from './expoFileSource';
import { importBackup, type ImportBackupDeps } from './importBackup';
import { BackupCancelledError } from './readBackup';
import { resetImportState, setImportState } from './importStore';

export interface ImportSink {
  ingestBatch: ImportBackupDeps['ingestBatch'];
  /** Runs once after the last batch: links reversals, marks the import done, summarises the ledger. */
  finish: () => Promise<ImportSummary>;
}

let running: AbortController | null = null;

export function cancelImport(): void {
  running?.abort();
}

// Reads the picked file and publishes progress to the import store. Resolves when it ends;
// failures land in the store instead of throwing, because the caller is a button handler.
export async function startImport(uri: string, sink: ImportSink): Promise<void> {
  if (running) return;
  const controller = new AbortController();
  running = controller;
  resetImportState();
  setImportState({ phase: 'running' });
  try {
    const result = await importBackup({
      source: openExpoFile(uri),
      ingestBatch: sink.ingestBatch,
      onProgress: (p) => setImportState(p),
      signal: controller.signal,
    });
    const summary = await sink.finish();
    setImportState({ ...result, summary, phase: 'done' });
  } catch (e) {
    setImportState({ phase: e instanceof BackupCancelledError ? 'cancelled' : 'failed' });
  } finally {
    running = null;
  }
}
