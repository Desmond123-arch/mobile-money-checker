import { AMOUNT, shapeTemplate } from '../fields';

/** "Cash In received for GHS 101.00 from NAME. Current Balance GHS … Transaction ID: … Fee charged: GHS 0." Free for the receiver. */
export const cashIn = shapeTemplate({
  name: 'cash_in',
  version: 1,
  kind: 'cash_in',
  direction: 'in',
  head: new RegExp(
    String.raw`^Cash In received for ${AMOUNT} from (?<name>.+?)\s*\.?\s*Current Balance`,
  ),
});
