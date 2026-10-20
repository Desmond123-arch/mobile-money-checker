/** Average spend by weekday (whole cedis) and six months of money out and in. Stand-ins for the insights queries. */
export const WEEKDAYS = [
  { label: 'Mon', cedis: 42 },
  { label: 'Tue', cedis: 36 },
  { label: 'Wed', cedis: 44 },
  { label: 'Thu', cedis: 54 },
  { label: 'Fri', cedis: 94 },
  { label: 'Sat', cedis: 54 },
  { label: 'Sun', cedis: 26 },
] as const;

export const MONTHS = [
  { label: 'May', out: 1180, in: 960 },
  { label: 'Jun', out: 1330, in: 1060 },
  { label: 'Jul', out: 1450, in: 810 },
  { label: 'Aug', out: 1610, in: 1270 },
  { label: 'Sep', out: 1570, in: 990 },
  { label: 'Oct', out: 1320, in: 850 },
] as const;
