import { pesewas } from '@/domain/money';
import type { TransactionDetail, TransactionRow } from '@/domain/transaction/transaction';

const row = (
  id: string,
  counterparty: string,
  categoryId: string | null,
  note: string | null,
  cedis: number,
  direction: 'in' | 'out' = 'out',
): TransactionRow => ({
  id,
  counterparty,
  categoryId,
  note,
  direction,
  amount: pesewas(Math.round(cedis * 100)),
});

export interface DayGroup {
  label: string;
  total: ReturnType<typeof pesewas>;
  rows: TransactionRow[];
}

export const SAMPLE_DAYS: readonly DayGroup[] = [
  {
    label: 'Today · Tue 20 Oct',
    total: pesewas(-4250),
    rows: [
      row('t1', 'Kojo Asante Pharmacy', 'health', 'paracetamol', 24),
      row('t2', 'Bolt', 'transport', 'to campus', 18.5),
    ],
  },
  {
    label: 'Yesterday · Mon 19 Oct',
    total: pesewas(-7700),
    rows: [
      row('t3', 'Auntie Ama Provisions', 'food', 'rice, eggs', 32),
      row('t4', 'Abena Boateng', 'income', 'payback', 100, 'in'),
      row('t5', 'Circle Mart', null, null, 45),
    ],
  },
  {
    label: 'Sun 18 Oct',
    total: pesewas(-18000),
    rows: [row('t6', 'Georgina Pomaa', 'family', 'maa', 180)],
  },
];

export const SAMPLE_RECENT: readonly { row: TransactionRow; when: string }[] = [
  { row: SAMPLE_DAYS[0]!.rows[0]!, when: 'Today' },
  { row: SAMPLE_DAYS[0]!.rows[1]!, when: 'Today' },
  { row: SAMPLE_DAYS[1]!.rows[0]!, when: 'Yesterday' },
];

export const SAMPLE_DETAIL: TransactionDetail = {
  ...row('t3', 'Auntie Ama Provisions', 'food', 'rice, eggs', 32),
  occurredAtLabel: 'Tue 20 Oct · 12:41',
  kindLabel: 'Paid to a merchant.',
  balanceAfter: pesewas(41184),
  noteSource: 'sms',
  originalMessage:
    'Payment for GHS32.00 to Auntie Ama Provisions has been completed. Reference: rice, eggs. Fee GHS0.16. Balance GHS411.84.',
};
