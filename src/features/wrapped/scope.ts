import type { WrappedScope } from '@/domain/summary/wrapped';

type Param = string | string[] | undefined;

const first = (p: Param) => (Array.isArray(p) ? p[0] : p);

/** Reads the route params `scope=year&year=2025` or `scope=all`; null for anything else. */
export function parseWrappedScope(scope: Param, year: Param): WrappedScope | null {
  const kind = first(scope);
  if (kind === 'all') return { kind: 'all' };
  const y = first(year);
  if (kind === 'year' && y !== undefined && /^\d{4}$/.test(y)) {
    return { kind: 'year', year: Number(y) };
  }
  return null;
}

/** The route params for a scope, the inverse of `parseWrappedScope`. */
export const wrappedParams = (scope: WrappedScope): Record<string, string> =>
  scope.kind === 'year' ? { scope: 'year', year: String(scope.year) } : { scope: 'all' };

/** The slide after a tap: a step forward or back, held at the first and last slide. */
export const stepSlide = (index: number, count: number, step: 1 | -1): number =>
  Math.min(count - 1, Math.max(0, index + step));
