// Streaming UTF-8 decoder. Hermes does not reliably ship TextDecoder, and a chunk boundary
// can split a multi-byte sequence, so the incomplete tail is carried to the next call.
export class Utf8Decoder {
  private carry: number[] = [];

  decode(bytes: Uint8Array, final = false): string {
    let data = bytes;
    if (this.carry.length > 0) {
      data = new Uint8Array(this.carry.length + bytes.length);
      data.set(this.carry, 0);
      data.set(bytes, this.carry.length);
      this.carry = [];
    }
    let end = data.length;
    if (!final) {
      const keep = incompleteTail(data);
      this.carry = Array.from(data.subarray(end - keep));
      end -= keep;
    }
    return decodeComplete(data, end);
  }
}

// Bytes at the end that start a sequence which the chunk does not finish.
function incompleteTail(data: Uint8Array): number {
  const n = data.length;
  for (let back = 1; back <= Math.min(3, n); back++) {
    const b = data[n - back] ?? 0;
    if ((b & 0xc0) === 0x80) continue;
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? back : 0;
  }
  return 0;
}

const cont = (data: Uint8Array, i: number, end: number) =>
  i < end && ((data[i] ?? 0) & 0xc0) === 0x80;

function decodeComplete(data: Uint8Array, end: number): string {
  const units: number[] = [];
  const parts: string[] = [];
  const flush = () => {
    parts.push(String.fromCharCode.apply(null, units));
    units.length = 0;
  };
  let i = 0;
  while (i < end) {
    const b = data[i] ?? 0;
    let cp = 0xfffd;
    let len = 1;
    if (b < 0x80) {
      cp = b;
    } else if (b >= 0xc2 && b < 0xe0 && cont(data, i + 1, end)) {
      cp = ((b & 0x1f) << 6) | ((data[i + 1] ?? 0) & 0x3f);
      len = 2;
    } else if (b >= 0xe0 && b < 0xf0 && cont(data, i + 1, end) && cont(data, i + 2, end)) {
      const v =
        ((b & 0x0f) << 12) | (((data[i + 1] ?? 0) & 0x3f) << 6) | ((data[i + 2] ?? 0) & 0x3f);
      if (v >= 0x800 && (v < 0xd800 || v > 0xdfff)) {
        cp = v;
        len = 3;
      }
    } else if (
      b >= 0xf0 &&
      b < 0xf5 &&
      cont(data, i + 1, end) &&
      cont(data, i + 2, end) &&
      cont(data, i + 3, end)
    ) {
      const v =
        ((b & 0x07) << 18) |
        (((data[i + 1] ?? 0) & 0x3f) << 12) |
        (((data[i + 2] ?? 0) & 0x3f) << 6) |
        ((data[i + 3] ?? 0) & 0x3f);
      if (v >= 0x10000 && v <= 0x10ffff) {
        cp = v;
        len = 4;
      }
    }
    if (cp >= 0x10000) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    i += len;
    if (units.length >= 4096) flush();
  }
  flush();
  return parts.join('');
}
