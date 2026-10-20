export type ImportPhase = 'idle' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ImportState {
  phase: ImportPhase;
  read: number;
  total: number;
  payments: number;
  // True while the parser and ledger are not connected: `payments` is then always 0.
  ingestIsStub: boolean;
}

const IDLE: ImportState = { phase: 'idle', read: 0, total: 0, payments: 0, ingestIsStub: false };

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
