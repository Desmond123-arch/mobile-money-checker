import { AMOUNT, shapeTemplate } from '../fields';

/**
 * "Y'ello. You have Paid GHS 10 to Merchant 033097 on your … account at 202408131727."
 * The 12-digit value is yyyy+dd+HH+mm+ss with no month, so there is no group for it and the received
 * time is used. The reference is "Message from sender:".
 */
export const merchantPaid = shapeTemplate({
  name: 'merchant_paid',
  version: 1,
  kind: 'payment_out',
  direction: 'out',
  head: new RegExp(
    String.raw`^(?:Y'ello\.\s*)?You have Paid ${AMOUNT} to (?<name>.+?) on your .+? account at \d+`,
  ),
  reference: /Message from sender:\s*(.*?)\s*\.?\s*Your new balance/,
});
