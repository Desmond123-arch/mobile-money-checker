export interface OccurredAt {
  at: number;
  source: 'body' | 'received';
}

const ISO_BODY_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

/**
 * Parse the `yyyy-MM-dd HH:mm:ss` time that some MoMo messages carry, as UTC epoch milliseconds
 * (Ghana is UTC+0 with no daylight saving). Returns null for anything else, including impossible
 * dates. The 12-digit value in "You have Paid" messages is `yyyy` `dd` `HH` `mm` `ss` with no month,
 * so it cannot be turned into a date and is deliberately not accepted here.
 */
export function parseBodyTime(text: string): number | null {
  const match = ISO_BODY_TIME.exec(text.trim());
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const at = Date.UTC(year, month - 1, day, hour, minute, second);
  const roundTrip = new Date(at);
  const valid =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day &&
    roundTrip.getUTCHours() === hour &&
    roundTrip.getUTCMinutes() === minute &&
    roundTrip.getUTCSeconds() === second;
  return valid ? at : null;
}

/** The body time when it parses, else the time the phone received the message. */
export function resolveOccurredAt(bodyTime: string | null, receivedAt: number): OccurredAt {
  const parsed = bodyTime === null ? null : parseBodyTime(bodyTime);
  return parsed === null ? { at: receivedAt, source: 'received' } : { at: parsed, source: 'body' };
}
