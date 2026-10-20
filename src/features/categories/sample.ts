import { pesewas } from '@/domain/money';
import type { CategorySpend } from '@/domain/category/share';

/** October 2026 sample spend, standing in for the summary query. */
export const SAMPLE_SPEND: readonly CategorySpend[] = [
  { categoryId: 'food', amount: pesewas(41200) },
  { categoryId: 'rent', amount: pesewas(22000) },
  { categoryId: 'transport', amount: pesewas(18650) },
  { categoryId: 'family', amount: pesewas(18000) },
  { categoryId: 'airtime', amount: pesewas(15000) },
  { categoryId: 'other', amount: pesewas(9200) },
];
