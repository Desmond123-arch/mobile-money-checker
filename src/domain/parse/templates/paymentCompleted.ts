import { AMOUNT, BODY_TIME, shapeTemplate } from '../fields';

/**
 * "Your payment of GHS 5.00 to NAME has been completed at <time>." The reference sits before or after
 * "Your new balance" depending on the layout, so it is read up to whichever comes next.
 */
export const paymentCompleted = shapeTemplate({
  name: 'payment_completed',
  version: 1,
  kind: 'payment_out',
  direction: 'out',
  head: new RegExp(
    String.raw`^Your payment of ${AMOUNT} to (?<name>.+?) has been completed at (?<time>${BODY_TIME})`,
  ),
  reference: /Reference:\s*(.*?)\s*\.?\s*(?=Your new balance|Financial Transaction Id)/,
});
