import { cashIn } from './templates/cashIn';
import { cashOut } from './templates/cashOut';
import { interest } from './templates/interest';
import { merchantPaid } from './templates/merchantPaid';
import { paymentCompleted } from './templates/paymentCompleted';
import { paymentFor } from './templates/paymentFor';
import { paymentMade } from './templates/paymentMade';
import { paymentReceived } from './templates/paymentReceived';
import { refund } from './templates/refund';
import { reversal } from './templates/reversal';
import { transferOut } from './templates/transferOut';
import type { Template } from './types';

/**
 * Tried in order. Every head is anchored at the start of the body, so order only matters between
 * shapes that could share a prefix; a wording change becomes a new template, not an edit.
 */
export const TEMPLATES: readonly Template[] = [
  paymentMade,
  paymentCompleted,
  paymentFor,
  merchantPaid,
  cashOut,
  transferOut,
  paymentReceived,
  cashIn,
  interest,
  refund,
  reversal,
];
