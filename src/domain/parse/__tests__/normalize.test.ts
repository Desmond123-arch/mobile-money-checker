import { normalizeBody } from '../normalize';

describe('normalizeBody', () => {
  it.each([
    ['Y’ello. You have Paid', "Y'ello. You have Paid"],
    ['Y‘ello', "Y'ello"],
    ['say “hi”', 'say "hi"'],
    ['MARYLORD CLASSY  ENTERPRISE', 'MARYLORD CLASSY ENTERPRISE'],
    ['line one\r\nline two\n', 'line one line two'],
    ['a b c', 'a b c'],
    ['  padded  ', 'padded'],
    ['', ''],
  ])('normalises %j', (input, expected) => {
    expect(normalizeBody(input)).toBe(expected);
  });
});
