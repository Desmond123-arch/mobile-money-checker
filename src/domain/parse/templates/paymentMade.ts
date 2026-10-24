import { AMOUNT, shapeTemplate } from '../fields';

/** "Payment made for GHS 5.00 to NAME Current Balance: … Reference: … Transaction ID: … Fee charged: … Tax charged: …" */
export const paymentMade = shapeTemplate({
  name: 'payment_made',
  version: 1,
  kind: 'payment_out',
  direction: 'out',
  head: new RegExp(String.raw`^Payment made for ${AMOUNT} to (?<name>.+?)\s*\.?\s*Current Balance`),
  reference: /Reference:\s*(.*?)\s*\.?\s*Transaction ID:/,
});
