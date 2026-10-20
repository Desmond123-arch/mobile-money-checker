import { AMOUNT, shapeTemplate } from '../fields';

/** "Cash Out made for GHS50.00 to AGENT. Current Balance: … Financial Transaction Id: … Fee charged: …" No reference, no tax. */
export const cashOut = shapeTemplate({
  name: 'cash_out',
  version: 1,
  kind: 'cash_out',
  direction: 'out',
  head: new RegExp(
    String.raw`^Cash Out made for ${AMOUNT} to (?<name>.+?)\s*\.?\s*Current Balance`,
  ),
});
