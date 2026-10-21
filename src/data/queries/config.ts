import type { Db } from '../db';

import { UI_CATEGORY_ID_SQL } from './sql';

export interface KeywordRow {
  value: string;
  isAlias: boolean;
  origin: 'seed' | 'user';
}

/** A category's words, the user's own first (newest first), then the seeded ones in seed order. */
export async function categoryKeywords(db: Db, categoryId: string): Promise<KeywordRow[]> {
  const rows = await db.all<{ value: string; is_alias: number; origin: 'seed' | 'user' }>(
    `SELECT k.value, k.is_alias, k.origin
     FROM keywords k JOIN categories c ON c.id = k.category_id
     WHERE ${UI_CATEGORY_ID_SQL} = ?
     ORDER BY k.origin = 'user' DESC, CASE WHEN k.origin = 'user' THEN -k.id ELSE k.id END`,
    [categoryId],
  );
  return rows.map((r) => ({ value: r.value, isAlias: r.is_alias === 1, origin: r.origin }));
}

/** Number of words per UI category id; categories with none are absent. */
export async function keywordCounts(db: Db): Promise<Record<string, number>> {
  const rows = await db.all<{ id: string; n: number }>(
    `SELECT ${UI_CATEGORY_ID_SQL} AS id, COUNT(*) AS n
     FROM keywords k JOIN categories c ON c.id = k.category_id GROUP BY c.id`,
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}

/** What deleting a category would touch, for the confirmation. */
export interface CategoryImpact {
  /** User-made categories only; those with a system key are protected. */
  deletable: boolean;
  /** Live transactions that show under it today. */
  transactions: number;
  keywords: number;
  rules: number;
  /** Cash-out breakdown entries that move to Misc. */
  allocations: number;
  /** 0 until the budgets migration exists. */
  budgets: number;
}

export async function categoryImpact(db: Db, categoryId: string): Promise<CategoryImpact | null> {
  const category = await db.get<{ id: number; system_key: string | null }>(
    `SELECT c.id, c.system_key FROM categories c WHERE ${UI_CATEGORY_ID_SQL} = ?`,
    [categoryId],
  );
  if (category === null) return null;
  const count = async (sql: string) => (await db.get<{ n: number }>(sql, [category.id]))?.n ?? 0;
  const hasBudgets = await db.get(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'budgets'`,
  );
  return {
    deletable: category.system_key === null,
    transactions: await count(
      `SELECT COUNT(*) AS n FROM transaction_category tc
       JOIN transactions t ON t.id = tc.transaction_id
       WHERE tc.category_id = ? AND t.retracted_at IS NULL`,
    ),
    keywords: await count('SELECT COUNT(*) AS n FROM keywords WHERE category_id = ?'),
    rules: await count('SELECT COUNT(*) AS n FROM recipient_rules WHERE category_id = ?'),
    allocations: await count('SELECT COUNT(*) AS n FROM cash_allocations WHERE category_id = ?'),
    budgets: hasBudgets
      ? await count('SELECT COUNT(*) AS n FROM budgets WHERE category_id = ?')
      : 0,
  };
}

export interface NameLists {
  family: string[];
  friend: string[];
}

export async function nameLists(db: Db): Promise<NameLists> {
  const rows = await db.all<{ kind: 'family' | 'friend'; value: string }>(
    'SELECT kind, value FROM name_lists ORDER BY id',
  );
  return {
    family: rows.filter((r) => r.kind === 'family').map((r) => r.value),
    friend: rows.filter((r) => r.kind === 'friend').map((r) => r.value),
  };
}

export interface UnreadMessage {
  id: number;
  receivedAt: number;
  status: 'unparsed' | 'error';
  reason: string | null;
}

/** "Messages we couldn't read": inbox messages only. Message text is never stored. */
export async function unreadMessages(db: Db): Promise<UnreadMessage[]> {
  const rows = await db.all<{
    id: number;
    received_at: number;
    status: 'unparsed' | 'error';
    reason: string | null;
  }>('SELECT id, received_at, status, reason FROM unread_messages ORDER BY received_at DESC');
  return rows.map((r) => ({
    id: r.id,
    receivedAt: r.received_at,
    status: r.status,
    reason: r.reason,
  }));
}
