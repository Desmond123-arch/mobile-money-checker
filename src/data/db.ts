import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /** Runs `fn` in one exclusive transaction: commits if it resolves, rolls back if it throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

export const DEFAULT_DB_NAME = 'momo.db';

function bind(db: SQLiteDatabase): Omit<Db, 'transaction'> {
  return {
    exec: (sql) => db.execAsync(sql),
    run: (sql, params = []) => db.runAsync(sql, [...params]),
    all: (sql, params = []) => db.getAllAsync(sql, [...params]),
    get: (sql, params = []) => db.getFirstAsync(sql, [...params]),
  };
}

// expo-sqlite runs an exclusive transaction on a brand-new native connection, and SQLite's
// foreign_keys pragma is per connection and defaults to OFF. It is also a no-op once a
// transaction is open, so the only way to enable it there is to close the BEGIN expo issued,
// set the pragma, and reopen with IMMEDIATE (which takes the write lock up front instead of
// failing later when a deferred transaction tries to upgrade).
async function enforceForeignKeys(tx: SQLiteDatabase): Promise<void> {
  await tx.execAsync(
    'COMMIT; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE',
  );
  const row = await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (row?.foreign_keys !== 1) {
    throw new Error('foreign key enforcement could not be enabled on the transaction connection');
  }
}

function wrap(db: SQLiteDatabase): Db {
  return {
    ...bind(db),
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      let result: T;
      await db.withExclusiveTransactionAsync(async (txn) => {
        await enforceForeignKeys(txn);
        const inner: Db = {
          ...bind(txn),
          // A nested call joins the open transaction; a second exclusive one would deadlock on the write lock.
          transaction: (nested) => nested(inner),
        };
        result = await fn(inner);
      });
      return result!;
    },
  };
}

export async function openDatabase(name: string = DEFAULT_DB_NAME): Promise<Db> {
  const db = await openDatabaseAsync(name);
  // Order matters: journal_mode returns a row and must not run inside a transaction.
  await db.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000',
  );
  return wrap(db);
}
