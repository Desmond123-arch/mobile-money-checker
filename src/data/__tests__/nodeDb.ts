import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Db, RunResult, SqlValue } from '../db';

export function openNodeDb(path: string = ':memory:'): Db & { close(): void } {
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON');

  const bound = (params: readonly SqlValue[]): SQLInputValue[] => [...params];
  let tail: Promise<unknown> = Promise.resolve();

  const make = (inTx: boolean): Db => ({
    async exec(sql) {
      raw.exec(sql);
    },
    async run(sql, params = []): Promise<RunResult> {
      const r = raw.prepare(sql).run(...bound(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async all<T>(sql: string, params: readonly SqlValue[] = []) {
      return raw.prepare(sql).all(...bound(params)) as T[];
    },
    async get<T>(sql: string, params: readonly SqlValue[] = []) {
      return (raw.prepare(sql).get(...bound(params)) as T | undefined) ?? null;
    },
    transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if (inTx) return fn(txDb);
      // Chaining models the exclusivity of expo's withExclusiveTransactionAsync: one writer at a time.
      const run = tail.then(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try {
          const out = await fn(txDb);
          raw.exec('COMMIT');
          return out;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    },
  });

  const txDb = make(true);
  return { ...make(false), close: () => raw.close() };
}
