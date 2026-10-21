import type { Migration } from '../migrate';
import { init } from './0001_init';
import { cashAllocations } from './0002_cash_allocations';

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'init', sql: init },
  { version: 2, name: 'cash_allocations', sql: cashAllocations },
];
