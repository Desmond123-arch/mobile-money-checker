import { weekdayLabel } from '@/domain/calendar/week';
import { pesewas } from '@/domain/money';
import { allocate } from '@/domain/category/share';
import { summaryFor } from '@/features/home';
import { MONTH_OPTIONS, monthOfIso } from '@/features/period';

export const WEEKDAYS = [
  { label: 'Mon', name: 'Monday', cedis: 42 },
  { label: 'Tue', name: 'Tuesday', cedis: 36 },
  { label: 'Wed', name: 'Wednesday', cedis: 44 },
  { label: 'Thu', name: 'Thursday', cedis: 54 },
  { label: 'Fri', name: 'Friday', cedis: 94 },
  { label: 'Sat', name: 'Saturday', cedis: 54 },
  { label: 'Sun', name: 'Sunday', cedis: 26 },
] as const;

export type WeekdayLabel = (typeof WEEKDAYS)[number]['label'];

const WEEKDAY_WEIGHTS: Record<WeekdayLabel, Record<string, number>> = {
  Mon: { food: 30, transport: 35, airtime: 10, family: 10, other: 15 },
  Tue: { food: 35, transport: 30, airtime: 5, family: 10, other: 20 },
  Wed: { food: 40, transport: 25, rent: 5, family: 10, other: 20 },
  Thu: { food: 35, transport: 20, airtime: 20, family: 10, other: 15 },
  Fri: { food: 40, rent: 10, transport: 15, family: 20, other: 15 },
  Sat: { food: 30, transport: 15, family: 30, other: 25 },
  Sun: { food: 25, transport: 10, family: 45, other: 20 },
};

export function weekdaySpend(label: WeekdayLabel) {
  const day = WEEKDAYS.find((d) => d.label === label);
  return allocate(pesewas((day?.cedis ?? 0) * 100), WEEKDAY_WEIGHTS[label]);
}

export const MONTHS = MONTH_OPTIONS.map((m) => ({
  label: m.short,
  out: Math.round(m.spent / 100),
  in: Math.round(m.moneyIn / 100),
}));

export function daySpend(iso: string) {
  const option = monthOfIso(iso);
  if (!option) return { total: pesewas(0), spend: [] };
  const day = Number(iso.slice(8, 10));
  const total = summaryFor(option).daily[day - 1] ?? pesewas(0);
  return { total, spend: allocate(total, WEEKDAY_WEIGHTS[weekdayLabel(iso)]) };
}
