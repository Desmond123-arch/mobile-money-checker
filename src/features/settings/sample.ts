export const CATEGORY_WORD_COUNTS: Record<string, string> = {
  food: '64 words',
  rent: '18 words',
  transport: '14 words',
  family: 'uses names',
  airtime: '7 words',
};

export const FAMILY_NAMES = ['maa', 'paa', 'naana'];
export const FRIEND_NAMES = ['andy', 'kofi'];

export const UNREAD_MESSAGES = [
  {
    id: 'u1',
    when: 'Fri 16 Oct · 08:12',
    hint: 'Not a payment?',
    body: "Y'ello Valued Customer, your wallet limit has been upgraded. Dial *170# to view your new limits. Thank you for choosing MTN MoMo.",
    looksLikePayment: false,
  },
  {
    id: 'u2',
    when: 'Wed 14 Oct · 19:40',
    hint: 'Looks like a payment',
    body: 'Bill payment of GHS 60.00 to ECG PREPAID has been completed. Token: 4521 8839 0012 7765. New balance GHS 351.20. Ref 41802219377.',
    looksLikePayment: true,
  },
] as const;
