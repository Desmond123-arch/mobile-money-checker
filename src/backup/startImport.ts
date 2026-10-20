import { openExpoFile } from './expoFileSource';
import { importBackup, type ImportBackupDeps } from './importBackup';
import { BackupCancelledError } from './readBackup';
import { resetImportState, setImportState } from './importStore';

type IngestBatch = ImportBackupDeps['ingestBatch'];

// Stand-in until the parser and ledger exist. Replace it by passing a real `ingestBatch`.
const pendingIngest: IngestBatch = async () => ({ payments: 0 });

let running: AbortController | null = null;

export function cancelImport(): void {
  running?.abort();
}

// Reads the picked file and publishes progress to the import store. Resolves when it ends;
// failures land in the store instead of throwing, because the caller is a button handler.
export async function startImport(uri: string, ingestBatch?: IngestBatch): Promise<void> {
  if (running) return;
  const controller = new AbortController();
  running = controller;
  resetImportState();
  setImportState({ phase: 'running', ingestIsStub: ingestBatch === undefined });
  try {
    const result = await importBackup({
      source: openExpoFile(uri),
      ingestBatch: ingestBatch ?? pendingIngest,
      onProgress: (p) => setImportState(p),
      signal: controller.signal,
    });
    setImportState({ ...result, phase: 'done' });
  } catch (e) {
    setImportState({ phase: e instanceof BackupCancelledError ? 'cancelled' : 'failed' });
  } finally {
    running = null;
  }
}
