import { useMemo } from 'react';

export function useToday(): Date {
  return useMemo(() => new Date(), []);
}
