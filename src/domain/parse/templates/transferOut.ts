import { BODY_TIME, NUMBER, shapeTemplate } from '../fields';

/** "You have transferred 10.00 GHS to Other Networks (one4all.sp) from your … account <wallet> at <time>." Carries no fee. */
export const transferOut = shapeTemplate({
  name: 'transfer_out',
  version: 1,
  kind: 'transfer_out',
  direction: 'out',
  head: new RegExp(
    String.raw`^You have transferred (?<amount>${NUMBER}) GHS to (?<name>.+?) from your .+? account(?: \d+)? at (?<time>${BODY_TIME})`,
  ),
  reference: /Message from sender:\s*(.*?)\s*\.?\s*Message to receiver/,
});
