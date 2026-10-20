import { hasTxnLabel } from './fields';
import { normalizeBody } from './normalize';
import { TEMPLATES } from './registry';
import type { ParseResult, RawSms } from './types';

const FAILED = /\bhas failed\b/i;

function classify(sms: RawSms): ParseResult {
  const body = normalizeBody(sms.body);
  if (body.startsWith('<#>')) return { status: 'ignored', reason: 'otp' };
  if (!hasTxnLabel(body)) return { status: 'ignored', reason: 'no_txn_id' };
  // Shape 2's head requires "has been completed", so a failed payment can never reach it and count as spend.
  if (FAILED.test(body)) return { status: 'ignored', reason: 'failed' };

  for (const template of TEMPLATES) {
    if (!template.test(body)) continue;
    const fragment = template.parse(body, sms);
    if (fragment !== null) return { status: 'parsed', fragment };
  }
  return { status: 'unparsed' };
}

/** Never throws: a body the parser cannot handle is `unparsed`, not a crash in the scan. */
export function parseSms(sms: RawSms): ParseResult {
  try {
    return classify(sms);
  } catch {
    return { status: 'unparsed' };
  }
}
