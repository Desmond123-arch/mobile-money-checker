import { parseSms } from '../parse';
import { sms } from './helpers';

describe('parseSms classification', () => {
  it.each([
    ['<#> Please enter the following code: 123456 to complete your login. Transaction Id: 5'],
    ['<#> DO NOT share this SMS. This OTP is required to continue.'],
  ])('ignores an OTP before anything else: %s', (body) => {
    expect(parseSms(sms(body))).toEqual({ status: 'ignored', reason: 'otp' });
  });

  it.each([
    ['Don’t miss out! Pay your TV bills with MTN MoMo.'],
    ['Payment received for GHS 5.00 from X. External Transaction Id: 12345.'],
    [''],
  ])('ignores a message with no transaction-id label: %j', (body) => {
    expect(parseSms(sms(body))).toEqual({ status: 'ignored', reason: 'no_txn_id' });
  });

  it('ignores a failed payment so it can never count as spend', () => {
    const body =
      'Your payment of GHS 30.00 to VODAFONE PUSH has failed at 2024-10-08 17:17:11. Reference: bundle. Financial Transaction Id: 45637568851. External Transaction Id: -. TRANSACTION FEE IS 0';
    expect(parseSms(sms(body))).toEqual({ status: 'ignored', reason: 'failed' });
  });

  it('reports a labelled message that matches no template as unparsed', () => {
    expect(parseSms(sms('Something new from MTN. Transaction ID: 123.'))).toEqual({
      status: 'unparsed',
    });
  });

  it('never throws, even on a body that is not a string', () => {
    expect(
      parseSms({
        androidId: '1',
        sender: 'MobileMoney',
        body: undefined as unknown as string,
        receivedAt: 0,
      }),
    ).toEqual({
      status: 'unparsed',
    });
  });

  it('accepts the case-insensitive label variants', () => {
    const body =
      'Cash Out made for GHS5.00 to AGENT. Current Balance: GHS10.00 Financial Transaction Id: 777. Fee charged: GHS0.05.';
    expect(parseSms(sms(body)).status).toBe('parsed');
    expect(parseSms(sms(body.replace('Financial Transaction Id', 'transaction ID'))).status).toBe(
      'parsed',
    );
  });
});
