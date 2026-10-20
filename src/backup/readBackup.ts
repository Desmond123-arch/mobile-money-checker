import { SmsTagScanner, decodeAttribute, readSmsAttributes } from './smsTags';
import { Utf8Decoder } from './utf8';

export const MOMO_ADDRESS = 'MobileMoney';

export interface ByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface DisposableSource extends ByteSource {
  dispose(): void;
}

export interface BackupMessage {
  body: string;
  receivedAt: number;
  address: string;
}

export interface BackupProgress {
  bytesRead: number;
  size: number;
  messages: number;
}

export interface ReadOptions {
  signal?: AbortSignal | undefined;
  onProgress?: ((progress: BackupProgress) => void) | undefined;
  chunkSize?: number | undefined;
  batchSize?: number | undefined;
}

export class BackupCancelledError extends Error {
  constructor() {
    super('Backup import cancelled');
    this.name = 'BackupCancelledError';
  }
}

const DEFAULT_CHUNK = 256 * 1024;
const DEFAULT_BATCH = 200;

async function* scanChunks(
  source: ByteSource,
  opts: ReadOptions,
): AsyncGenerator<{ tags: string[]; bytesRead: number }> {
  const chunk = Math.max(1, opts.chunkSize ?? DEFAULT_CHUNK);
  const decoder = new Utf8Decoder();
  const scanner = new SmsTagScanner();
  let offset = 0;
  while (offset < source.size) {
    if (opts.signal?.aborted) throw new BackupCancelledError();
    const bytes = await source.read(offset, Math.min(chunk, source.size - offset));
    if (bytes.length === 0) throw new Error('Backup file ended before its reported size');
    offset += bytes.length;
    const tags: string[] = [];
    scanner.feed(decoder.decode(bytes, offset >= source.size), (tag) => tags.push(tag));
    yield { tags, bytesRead: offset };
  }
}

function toMessage(tag: string): BackupMessage | null {
  const attrs = readSmsAttributes(tag);
  if (decodeAttribute(attrs.address) !== MOMO_ADDRESS) return null;
  const body = decodeAttribute(attrs.body);
  const receivedAt = Number(attrs.date);
  if (body === null || !Number.isFinite(receivedAt) || attrs.date === '') return null;
  return { body, receivedAt, address: MOMO_ADDRESS };
}

// Same filter as readBackupMessages, so the total matches what will be yielded.
export async function countBackupMessages(
  source: ByteSource,
  opts: ReadOptions = {},
): Promise<number> {
  let count = 0;
  for await (const { tags, bytesRead } of scanChunks(source, opts)) {
    for (const tag of tags) if (toMessage(tag)) count += 1;
    opts.onProgress?.({ bytesRead, size: source.size, messages: count });
  }
  return count;
}

export async function* readBackupMessages(
  source: ByteSource,
  opts: ReadOptions = {},
): AsyncGenerator<BackupMessage[]> {
  const batchSize = Math.max(1, opts.batchSize ?? DEFAULT_BATCH);
  let batch: BackupMessage[] = [];
  let count = 0;
  for await (const { tags, bytesRead } of scanChunks(source, opts)) {
    for (const tag of tags) {
      const message = toMessage(tag);
      if (!message) continue;
      count += 1;
      batch.push(message);
      if (batch.length >= batchSize) {
        const full = batch;
        batch = [];
        yield full;
        if (opts.signal?.aborted) throw new BackupCancelledError();
      }
    }
    opts.onProgress?.({ bytesRead, size: source.size, messages: count });
  }
  if (batch.length > 0) yield batch;
}
