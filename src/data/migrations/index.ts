import type { Migration } from '../migrate';
import { init } from './0001_init';

export const MIGRATIONS: readonly Migration[] = [{ version: 1, name: 'init', sql: init }];
