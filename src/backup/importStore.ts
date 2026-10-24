import type { ImportSummary } from '@/ledger/importSummary';

export type ImportPhase = 'idle' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ImportState {
  phase: ImportPhase;
  read: number;
  total: number;
  payments: number;
  /** Set when the phase is 'done'. */
  summary: ImportSummary | null;
  /** What is filling the store: a picked backup file or the inbox scan. */
  kind: 'backup' | 'scan';
  /** A scan finished with permission but found no MobileMoney message. */
  empty: boolean;
}

const IDLE: ImportState = {
  phase: 'idle',
  read: 0,
  total: 0,
  payments: 0,
  summary: null,
  kind: 'backup',
  empty: false,
};

let state: ImportState = IDLE;
const listeners = new Set<() => void>();

export const getImportState = (): ImportState => state;

export function setImportState(next: Partial<ImportState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function resetImportState(): void {
  state = IDLE;
  listeners.forEach((l) => l());
}

export function subscribeImportState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
