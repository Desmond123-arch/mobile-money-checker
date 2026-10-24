import { importBackup, type ImportProgress } from '../importBackup';
import { BackupCancelledError, type DisposableSource } from '../readBackup';

const sms = (n: number) => `<sms address="MobileMoney" date="${n}" body="m${n}" />`;

function fakeSource(text: string) {
  const bytes = Buffer.from(text);
  const source: DisposableSource & { disposed: number } = {
    size: bytes.length,
    disposed: 0,
    read: async (offset, length) => new Uint8Array(bytes.subarray(offset, offset + length)),
    dispose() {
      this.disposed += 1;
    },
  };
  return source;
}

const FILE = `<smses>${[1, 2, 3, 4, 5].map(sms).join('')}<sms address="Other" date="9" body="x" /></smses>`;

describe('importBackup', () => {
  it('counts first, then feeds batches to ingestBatch and reports running totals', async () => {
    const source = fakeSource(FILE);
    const seen: number[][] = [];
    const progress: ImportProgress[] = [];
    const result = await importBackup({
      source,
      batchSize: 2,
      ingestBatch: async (messages) => {
        seen.push(messages.map((m) => m.receivedAt));
        return { payments: messages.length - 1 };
      },
      onProgress: (p) => progress.push(p),
    });
    expect(seen).toEqual([[1, 2], [3, 4], [5]]);
    expect(progress[0]).toEqual({ read: 0, total: 5, payments: 0 });
    expect(result).toEqual({ read: 5, total: 5, payments: 2 });
    expect(progress.at(-1)).toEqual(result);
    expect(source.disposed).toBe(1);
  });

  it('disposes the source when ingest fails', async () => {
    const source = fakeSource(FILE);
    await expect(
      importBackup({
        source,
        ingestBatch: async () => {
          throw new Error('db down');
        },
        onProgress: () => {},
      }),
    ).rejects.toThrow('db down');
    expect(source.disposed).toBe(1);
  });

  it('disposes the source when cancelled', async () => {
    const source = fakeSource(FILE);
    const controller = new AbortController();
    await expect(
      importBackup({
        source,
        batchSize: 1,
        signal: controller.signal,
        ingestBatch: async () => {
          controller.abort();
          return { payments: 0 };
        },
        onProgress: () => {},
      }),
    ).rejects.toBeInstanceOf(BackupCancelledError);
    expect(source.disposed).toBe(1);
  });
});
