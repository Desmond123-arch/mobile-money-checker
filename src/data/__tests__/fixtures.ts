import type { Db, SqlValue } from '../db';
import { migrate } from '../migrate';
import { MIGRATIONS } from '../migrations';
import { seedDatabase } from '../seed';
import { openNodeDb } from './nodeDb';

export async function setup() {
  const db = openNodeDb();
  await migrate(db, MIGRATIONS);
  await seedDatabase(db, 1_000);
  return db;
}

export const categoryId = async (db: Db, key: string) =>
  (await db.get<{ id: number }>('SELECT id FROM categories WHERE system_key = ?', [key]))!.id;

type Row = Record<string, SqlValue>;

async function insert(db: Db, table: string, row: Row): Promise<number> {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
  return (await db.run(sql, Object.values(row))).lastInsertRowId;
}

let seq = 0;

export const addMessage = (db: Db, over: Row = {}) => {
  seq += 1;
  return insert(db, 'sms_messages', {
    source: 'inbox',
    android_sms_id: seq,
    received_at: 1_000 + seq,
    sender: 'MobileMoney',
    status: 'parsed',
    reason: null,
    parser_version: 1,
    first_seen_at: 1,
    parsed_at: 1,
    ...over,
  });
};

export const addFragment = (db: Db, messageId: number, momoTxnId: string) =>
  db
    .run(
      `INSERT INTO sms_fragments (message_id, momo_txn_id, flow, kind, amount_pesewas, occurred_at,
         occurred_at_source, template_name, template_version) VALUES (?, ?, 'spend', 'payment_out', 1000, 1000, 'body', 't', 1)`,
      [messageId, momoTxnId],
    )
    .then(() => messageId);

export const addTxn = async (db: Db, over: Row = {}) => {
  seq += 1;
  const manual = over.origin === 'manual';
  return insert(db, 'transactions', {
    origin: 'sms',
    momo_txn_id: manual ? null : `T${seq}`,
    flow: 'spend',
    kind: 'payment_out',
    amount_pesewas: 1000,
    occurred_at: 1_000,
    occurred_at_source: manual ? 'user' : 'body',
    created_at: 1,
    updated_at: 1,
    ...(manual
      ? {}
      : { auto_category_id: await categoryId(db, 'misc'), auto_category_source: 'default' }),
    ...over,
  });
};

export const addLink = (db: Db, credit: number, original: number | null, over: Row = {}) =>
  insert(db, 'reversal_links', {
    credit_txn_id: credit,
    original_txn_id: original,
    linked_by: 'auto',
    confidence: 'exact',
    created_at: 1,
    ...over,
  });

export const annotate = (db: Db, transactionId: number, over: Row = {}) =>
  insert(db, 'transaction_annotations', {
    transaction_id: transactionId,
    updated_at: 1,
    ...over,
  });

const MONTH = 30 * 86_400_000;
export const month = (n: number) => ({ start: n * MONTH, end: (n + 1) * MONTH });

export async function sum(
  db: Db,
  where: string,
  params: readonly SqlValue[] = [],
): Promise<number> {
  const r = await db.get<{ s: number | null }>(
    `SELECT SUM(pesewas) AS s FROM ledger_lines WHERE ${where}`,
    params,
  );
  return r?.s ?? 0;
}
