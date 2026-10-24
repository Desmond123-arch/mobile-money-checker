import { readFileSync } from 'node:fs';
import type { RawSms } from '../../src/domain/parse/types';

// The exporter switches to single quotes for a body that itself contains a double quote.
const SMS_TAG = /<sms\s((?:[^>"']|"[^"]*"|'[^']*')*?)\/>/g;
const ATTRIBUTE = /([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescapeXml(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (whole, dec, hex, named) => {
    if (dec !== undefined) return String.fromCodePoint(Number(dec));
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    return ENTITIES[named as string] ?? whole;
  });
}

/**
 * Read the `MobileMoney` messages from an SMS Backup & Restore XML export. The export has no `_id`, so
 * ids are assigned in file order, which is stable for one file.
 */
export function readMobileMoney(path: string, sender = 'MobileMoney'): RawSms[] {
  const xml = readFileSync(path, 'utf8');
  const messages: RawSms[] = [];
  let index = 0;
  for (const tag of xml.matchAll(SMS_TAG)) {
    const attributes: Record<string, string> = {};
    for (const [, key, double, single] of (tag[1] ?? '').matchAll(ATTRIBUTE)) {
      attributes[key as string] = unescapeXml((double ?? single) as string);
    }
    index += 1;
    if (attributes.address !== sender) continue;
    messages.push({
      androidId: String(index),
      sender,
      body: attributes.body ?? '',
      receivedAt: Number(attributes.date),
    });
  }
  return messages;
}
