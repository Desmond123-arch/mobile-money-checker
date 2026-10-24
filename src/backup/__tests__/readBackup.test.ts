import { closeSync, existsSync, fstatSync, openSync, readSync } from 'node:fs';

import {
  BackupCancelledError,
  countBackupMessages,
  readBackupMessages,
  type BackupMessage,
  type ByteSource,
  type ReadOptions,
} from '../readBackup';

const bufferSource = (text: string): ByteSource => {
  const bytes = Buffer.from(text, 'utf8');
  return {
    size: bytes.length,
    read: async (offset, length) => new Uint8Array(bytes.subarray(offset, offset + length)),
  };
};

async function collect(source: ByteSource, opts: ReadOptions = {}): Promise<BackupMessage[]> {
  const out: BackupMessage[] = [];
  for await (const batch of readBackupMessages(source, opts)) out.push(...batch);
  return out;
}

const momo = (body: string, date: number, extra = '') =>
  `<sms protocol="0" address="MobileMoney" date="${date}" type="1" body="${body}" ${extra}/>`;

const SYNTHETIC = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<!-- <sms address="MobileMoney" date="1" body="inside a comment" /> -->
<smses count="9">
  ${momo('Payment of GHS 5.00 &amp; fee &lt;1&gt; &quot;ok&quot; &apos;x&apos;', 100)}
  <sms address="AirtelTigo" date="101" body="not ours" />
  <sms date="102" body="Cash &#8373;&#x20B5; &#128512; &#x1F600; café \u{1F4B0}" address="MobileMoney"></sms>
  <mms date="103" address="MobileMoney"><parts><part data="&lt;sms address='MobileMoney' date='1' body='x'/&gt;" /></parts></mms>
  <sms address='MobileMoney' date='104' body='single "quoted" with > inside' />
  <sms address="MobileMoney" date="105" body="line&#10;two&#13;&#10;" readable_date="x" />
  <sms address="MobileMoneyX" date="106" body="lookalike" />
  <sms address="MobileMoney" date="107" />
</smses>`;

const EXPECTED = [
  { receivedAt: 100, body: `Payment of GHS 5.00 & fee <1> "ok" 'x'` },
  { receivedAt: 102, body: 'Cash ₵₵ \u{1F600} \u{1F600} café \u{1F4B0}' },
  { receivedAt: 104, body: `single "quoted" with > inside` },
  { receivedAt: 105, body: 'line\ntwo\r\n' },
].map((m) => ({ ...m, address: 'MobileMoney' }));

describe('readBackupMessages', () => {
  it('keeps only MobileMoney sms elements and decodes entities', async () => {
    expect(await collect(bufferSource(SYNTHETIC))).toEqual(EXPECTED);
  });

  it.each([1, 7, 64 * 1024])('gives identical output with %i byte chunks', async (chunkSize) => {
    expect(await collect(bufferSource(SYNTHETIC), { chunkSize })).toEqual(EXPECTED);
    expect(await countBackupMessages(bufferSource(SYNTHETIC), { chunkSize })).toBe(4);
  });

  it('batches in file order', async () => {
    const batches: number[][] = [];
    for await (const b of readBackupMessages(bufferSource(SYNTHETIC), { batchSize: 3 })) {
      batches.push(b.map((m) => m.receivedAt));
    }
    expect(batches).toEqual([[100, 102, 104], [105]]);
  });

  it('reports progress ending at the file size', async () => {
    const seen: number[] = [];
    const source = bufferSource(SYNTHETIC);
    await collect(source, { chunkSize: 100, onProgress: (p) => seen.push(p.bytesRead) });
    expect(seen[seen.length - 1]).toBe(source.size);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('stops when the signal aborts', async () => {
    const controller = new AbortController();
    const source = bufferSource(SYNTHETIC);
    await expect(
      collect(source, {
        chunkSize: 50,
        batchSize: 1,
        signal: controller.signal,
        onProgress: ({ messages }) => messages >= 1 && controller.abort(),
      }),
    ).rejects.toBeInstanceOf(BackupCancelledError);
  });

  it('rejects a source that ends early', async () => {
    const source: ByteSource = { size: 10, read: async () => new Uint8Array(0) };
    await expect(collect(source)).rejects.toThrow(/ended before/);
  });

  it('handles a multi-byte character cut at every offset', async () => {
    const text = `<sms address="MobileMoney" date="1" body="é₵\u{1F600}" />`;
    for (let chunkSize = 1; chunkSize < 12; chunkSize++) {
      expect((await collect(bufferSource(text), { chunkSize }))[0]?.body).toBe('é₵\u{1F600}');
    }
  });
});

const REAL = '/mnt/c/Users/Desmond Opoku Mends/Downloads/sms-20260621002856.xml';

(existsSync(REAL) ? describe : describe.skip)('real export', () => {
  const fileSource = (): { source: ByteSource; close: () => void } => {
    const fd = openSync(REAL, 'r');
    return {
      source: {
        size: fstatSync(fd).size,
        read: async (offset, length) => {
          const buf = Buffer.alloc(length);
          const n = readSync(fd, buf, 0, length, offset);
          return new Uint8Array(buf.subarray(0, n));
        },
      },
      close: () => closeSync(fd),
    };
  };

  it('finds 2,488 MobileMoney messages, the same at any chunk size', async () => {
    const { source, close } = fileSource();
    try {
      expect(await countBackupMessages(source)).toBe(2488);
      expect(await countBackupMessages(source, { chunkSize: 1000 })).toBe(2488);
      const all = await collect(source, { chunkSize: 4099 });
      expect(all).toHaveLength(2488);
      expect(all.every((m) => m.address === 'MobileMoney' && m.body.length > 0)).toBe(true);
      expect(all.some((m) => m.body.includes('�'))).toBe(false);
    } finally {
      close();
    }
  });
});
