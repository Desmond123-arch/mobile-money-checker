import { AMOUNT, BODY_TIME, shapeTemplate } from '../fields';

/**
 * "Y'ello Valued Customer, the transfer of GHS 3.00 to NAME has been reversed on <time> with transaction ID: …"
 * The id is the reversal's own, not the original's, so linking goes through linkReversals.
 */
export const reversal = shapeTemplate({
  name: 'reversal',
  version: 1,
  kind: 'reversal',
  direction: 'in',
  head: new RegExp(
    String.raw`^(?:[^,]{1,40},\s*)?the (?:payment|transfer) of ${AMOUNT} to (?<name>.+?) has been reversed on (?<time>${BODY_TIME})`,
    'i',
  ),
});
