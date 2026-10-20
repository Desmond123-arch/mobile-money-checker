import { AMOUNT, shapeTemplate } from '../fields';

/** "Payment received for GHS 5.00 from NAME Current Balance: … Reference: … Transaction ID: … TRANSACTION FEE: …" */
export const paymentReceived = shapeTemplate({
  name: 'payment_received',
  version: 1,
  kind: 'payment_in',
  direction: 'in',
  head: new RegExp(
    String.raw`^Payment received for ${AMOUNT} from (?<name>.*?)\s*\.?\s*Current Balance`,
  ),
  reference: /Reference:\s*(.*?)\s*\.?\s*Transaction ID:/,
});
