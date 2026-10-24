import { AMOUNT, shapeTemplate } from '../fields';

/** "Payment for GHS5.00 to NAME ..Current Balance: …" Airtime, bundles and MTN services; no reference, no time. */
export const paymentFor = shapeTemplate({
  name: 'payment_for',
  version: 1,
  kind: 'payment_out',
  direction: 'out',
  head: new RegExp(String.raw`^Payment for ${AMOUNT} to (?<name>.+?)\s*\.*\s*Current Balance`),
});
