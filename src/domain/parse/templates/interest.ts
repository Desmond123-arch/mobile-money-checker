import { AMOUNT, shapeTemplate } from '../fields';

/** "An amount of GHS 7.93 has been credited to your … account. Message:Interest for January to March 2024." */
export const interest = shapeTemplate({
  name: 'interest',
  version: 1,
  kind: 'interest',
  direction: 'in',
  head: new RegExp(String.raw`^An amount of ${AMOUNT} has been credited to your .+? account\.`),
  reference: /Message:\s*(.*?)\s*\.?\s*Your new balance/,
});
