import { AMOUNT, BODY_TIME, shapeTemplate } from '../fields';

/** "Hello, NAME has successfully refunded GHS 3.00 to your … account at <time>. Message from refunder: …" */
export const refund = shapeTemplate({
  name: 'refund',
  version: 1,
  kind: 'refund',
  direction: 'in',
  head: new RegExp(
    String.raw`^(?:[^,]{1,40},\s*)?(?<name>.+?) has successfully refunded ${AMOUNT} to your .+? account at (?<time>${BODY_TIME})`,
  ),
  reference: /Message from [^:]+:\s*(.*?)\s*\.?\s*Your new balance/,
});
