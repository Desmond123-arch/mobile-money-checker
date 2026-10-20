import { decodeEntities } from './xmlEntities';

// Pulls `<sms ...>` start tags out of text fed in arbitrary pieces. It is not an XML parser:
// every other element, comment, processing instruction and CDATA section is skipped, which is
// all the backup format needs (SMS Backup & Restore writes every field as an attribute).
export class SmsTagScanner {
  private buf = '';
  private resume = 0;
  private quote = '';

  feed(text: string, emit: (tag: string) => void): void {
    this.buf += text;
    const buf = this.buf;
    let i = 0;
    for (;;) {
      const lt = buf.indexOf('<', i);
      if (lt === -1) {
        this.reset('');
        return;
      }
      i = lt;
      const closer = specialCloser(buf, i);
      if (closer === undefined) return this.keep(i);
      if (closer !== null) {
        const from = Math.max(this.resume, i);
        const end = buf.indexOf(closer, from);
        if (end === -1) return this.keep(i, Math.max(from, buf.length - closer.length + 1));
        i = end + closer.length;
        this.resume = 0;
        continue;
      }
      const end = this.findTagEnd(buf, Math.max(this.resume, i + 1));
      if (end === -1) return this.keep(i, buf.length);
      if (isSmsStart(buf, i)) emit(buf.slice(i, end + 1));
      i = end + 1;
      this.resume = 0;
      this.quote = '';
    }
  }

  private findTagEnd(buf: string, from: number): number {
    let quote = this.quote;
    for (let j = from; j < buf.length; j++) {
      const c = buf.charAt(j);
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        return j;
      }
    }
    this.quote = quote;
    return -1;
  }

  private keep(from: number, resume = 0): void {
    this.buf = this.buf.slice(from);
    this.resume = Math.max(0, resume - from);
  }

  private reset(buf: string): void {
    this.buf = buf;
    this.resume = 0;
    this.quote = '';
  }
}

const OPENERS: readonly (readonly [string, string])[] = [
  ['<!--', '-->'],
  ['<![CDATA[', ']]>'],
  ['<?', '?>'],
  ['<!', '>'],
];

// A closing marker for a non-element construct, null for an element, undefined when the
// buffer is too short to tell.
function specialCloser(buf: string, i: number): string | null | undefined {
  if (buf.length - i < 9) {
    const tail = buf.slice(i);
    if (
      tail !== '<!--' &&
      tail.length < 9 &&
      ('<![CDATA['.startsWith(tail) || '<!--'.startsWith(tail))
    )
      return undefined;
  }
  for (const [open, close] of OPENERS) {
    if (buf.startsWith(open, i)) return close;
  }
  return null;
}

function isSmsStart(buf: string, i: number): boolean {
  if (!buf.startsWith('<sms', i)) return false;
  const next = buf.charCodeAt(i + 4);
  return next === 32 || next === 9 || next === 10 || next === 13 || next === 47 || next === 62;
}

const WANTED = new Set(['address', 'date', 'body']);

// Entities are decoded only for the attributes a caller asks for, so skipped senders never
// pay for decoding their body.
export function readSmsAttributes(tag: string): Record<string, string> {
  const raw: Record<string, string> = {};
  let i = 4;
  const n = tag.length;
  while (i < n) {
    while (i < n && /\s/.test(tag.charAt(i))) i++;
    const nameStart = i;
    while (i < n && !/[\s=/>]/.test(tag.charAt(i))) i++;
    const name = tag.slice(nameStart, i);
    while (i < n && /\s/.test(tag.charAt(i))) i++;
    if (tag.charAt(i) !== '=') {
      if (i === nameStart) i++;
      continue;
    }
    i++;
    while (i < n && /\s/.test(tag.charAt(i))) i++;
    const q = tag.charAt(i);
    if (q !== '"' && q !== "'") continue;
    const end = tag.indexOf(q, i + 1);
    if (end === -1) break;
    if (WANTED.has(name)) raw[name] = tag.slice(i + 1, end);
    i = end + 1;
  }
  return raw;
}

export function decodeAttribute(raw: string | undefined): string | null {
  return raw === undefined ? null : decodeEntities(raw);
}
