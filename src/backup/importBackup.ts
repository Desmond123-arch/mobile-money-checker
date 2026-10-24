import {
  countBackupMessages,
  readBackupMessages,
  type BackupMessage,
  type DisposableSource,
} from './readBackup';

export interface IngestResult {
  payments: number;
}

export interface ImportProgress {
  read: number;
  total: number;
  payments: number;
}

export interface ImportBackupDeps {
  source: DisposableSource;
  // The seam for the parser and ledger: parse the batch, write it in one transaction, report how
  // many payments it produced.
  ingestBatch: (messages: BackupMessage[]) => Promise<IngestResult>;
  onProgress: (progress: ImportProgress) => void;
  signal?: AbortSignal;
  chunkSize?: number;
  batchSize?: number;
}

export async function importBackup(deps: ImportBackupDeps): Promise<ImportProgress> {
  const { source, ingestBatch, onProgress, signal, chunkSize, batchSize } = deps;
  try {
    const total = await countBackupMessages(source, { signal, chunkSize });
    const progress: ImportProgress = { read: 0, total, payments: 0 };
    onProgress({ ...progress });
    for await (const batch of readBackupMessages(source, { signal, chunkSize, batchSize })) {
      const { payments } = await ingestBatch(batch);
      progress.read += batch.length;
      progress.payments += payments;
      onProgress({ ...progress });
    }
    return progress;
  } finally {
    source.dispose();
  }
}
