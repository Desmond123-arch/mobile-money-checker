import { pesewas, type Pesewas } from '@/domain/money';

export interface MonthOption {
  id: string;
  label: string;
  short: string;
  isCurrent: boolean;
  spent: Pesewas;
  moneyIn: Pesewas;
}

const month = (
  id: string,
  label: string,
  short: string,
  out: number,
  inn: number,
  isCurrent = false,
): MonthOption => ({
  id,
  label,
  short,
  isCurrent,
  spent: pesewas(out),
  moneyIn: pesewas(inn),
});

export const MONTH_OPTIONS: readonly MonthOption[] = [
  month('2026-05', 'May 2026', 'May', 118000, 96000),
  month('2026-06', 'June 2026', 'Jun', 133000, 106000),
  month('2026-07', 'July 2026', 'Jul', 145000, 81000),
  month('2026-08', 'August 2026', 'Aug', 161000, 127000),
  month('2026-09', 'September 2026', 'Sep', 157000, 99000),
  month('2026-10', 'October 2026', 'Oct', 124050, 80000, true),
];

export const CURRENT_MONTH = MONTH_OPTIONS[MONTH_OPTIONS.length - 1] as MonthOption;
