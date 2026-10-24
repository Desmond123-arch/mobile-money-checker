// Source of truth for the shape and the reasons is docs/data-model.md.
//
// A cash-out is cash taken from a MoMo agent. The user then spends it on several things over
// several days. An allocation says "this much of that withdrawal went to this category". It
// REDISTRIBUTES the cash-out's own amount; it never adds spend, so month totals do not change
// and the money still counts at the cash-out's date.
export const cashAllocations = `
CREATE TABLE cash_allocations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_out_txn_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount_pesewas  INTEGER NOT NULL CHECK (amount_pesewas > 0),
  note            TEXT CHECK (note IS NULL OR (note <> '' AND note = trim(note))),
  spent_on        INTEGER NOT NULL,  -- epoch ms UTC, informational: no total reads it
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
) STRICT;
CREATE INDEX cash_allocations_cash_out ON cash_allocations(cash_out_txn_id);

-- Triggers, not foreign keys, hold these two rules: foreign_keys can be OFF on a connection.
CREATE TRIGGER cash_allocations_target_insert
BEFORE INSERT ON cash_allocations
WHEN NOT EXISTS (SELECT 1 FROM transactions
                 WHERE id = NEW.cash_out_txn_id
                   AND origin = 'sms' AND kind = 'cash_out' AND flow = 'spend')
BEGIN
  SELECT RAISE(ABORT, 'an allocation belongs to a cash-out');
END;

CREATE TRIGGER cash_allocations_target_update
BEFORE UPDATE OF cash_out_txn_id ON cash_allocations
WHEN NOT EXISTS (SELECT 1 FROM transactions
                 WHERE id = NEW.cash_out_txn_id
                   AND origin = 'sms' AND kind = 'cash_out' AND flow = 'spend')
BEGIN
  SELECT RAISE(ABORT, 'an allocation belongs to a cash-out');
END;

CREATE TRIGGER cash_allocations_cap_insert
BEFORE INSERT ON cash_allocations
WHEN COALESCE((SELECT SUM(amount_pesewas) FROM cash_allocations
               WHERE cash_out_txn_id = NEW.cash_out_txn_id), 0) + NEW.amount_pesewas
     > COALESCE((SELECT amount_pesewas FROM transactions WHERE id = NEW.cash_out_txn_id), 0)
BEGIN
  SELECT RAISE(ABORT, 'allocations exceed the cash-out');
END;

CREATE TRIGGER cash_allocations_cap_update
BEFORE UPDATE OF cash_out_txn_id, amount_pesewas ON cash_allocations
WHEN COALESCE((SELECT SUM(amount_pesewas) FROM cash_allocations
               WHERE cash_out_txn_id = NEW.cash_out_txn_id AND id <> OLD.id), 0)
     + NEW.amount_pesewas
     > COALESCE((SELECT amount_pesewas FROM transactions WHERE id = NEW.cash_out_txn_id), 0)
BEGIN
  SELECT RAISE(ABORT, 'allocations exceed the cash-out');
END;

-- Same rule as 0001, with one change: a cash-out contributes (amount - allocated) in its
-- effective category, then one line per allocation in the allocation's category, all at the
-- cash-out's occurred_at. The remainder line is left out when it is 0 and something is
-- allocated. It is clamped at 0, so a cash-out whose amount later shrank below its
-- allocations cannot produce a negative line.
DROP VIEW ledger_lines;
CREATE VIEW ledger_lines AS
SELECT t.id AS transaction_id, t.occurred_at AS at, tc.category_id,
       'spend' AS bucket, 'amount' AS part,
       MAX(t.amount_pesewas - COALESCE(al.total, 0), 0) AS pesewas
FROM transactions t
JOIN transaction_category tc ON tc.transaction_id = t.id
LEFT JOIN (SELECT cash_out_txn_id, SUM(amount_pesewas) AS total
           FROM cash_allocations GROUP BY cash_out_txn_id) al ON al.cash_out_txn_id = t.id
WHERE t.flow = 'spend' AND t.retracted_at IS NULL
  AND (al.total IS NULL OR t.amount_pesewas > al.total)
UNION ALL
SELECT t.id, t.occurred_at, COALESCE(c.id, misc.id), 'spend', 'amount', a.amount_pesewas
FROM cash_allocations a
JOIN transactions t ON t.id = a.cash_out_txn_id
LEFT JOIN categories c    ON c.id = a.category_id
LEFT JOIN categories misc ON misc.system_key = 'misc'
WHERE t.flow = 'spend' AND t.retracted_at IS NULL
UNION ALL
SELECT t.id, t.occurred_at, tc.category_id, 'spend', 'charge', t.fee_pesewas + t.tax_pesewas
FROM transactions t
JOIN transaction_category tc ON tc.transaction_id = t.id
WHERE t.flow = 'spend' AND t.retracted_at IS NULL AND t.fee_pesewas + t.tax_pesewas > 0
UNION ALL
SELECT t.id, t.occurred_at, tc.category_id, 'income', 'amount', t.amount_pesewas
FROM transactions t
JOIN transaction_category tc ON tc.transaction_id = t.id
WHERE t.flow = 'income' AND t.retracted_at IS NULL
UNION ALL
SELECT o.id, o.occurred_at, tc.category_id, 'spend', 'credit', -MIN(o.amount_pesewas, o.credited)
FROM (SELECT x.id, x.occurred_at, x.amount_pesewas,
             (SELECT SUM(c.amount_pesewas)
              FROM reversal_links l
              JOIN transactions c ON c.id = l.credit_txn_id
                                 AND c.flow = 'credit' AND c.retracted_at IS NULL
              WHERE l.original_txn_id = x.id) AS credited
      FROM transactions x
      WHERE x.flow = 'spend' AND x.retracted_at IS NULL) o
JOIN transaction_category tc ON tc.transaction_id = o.id
WHERE o.credited > 0
UNION ALL
SELECT c.id, c.occurred_at, tc.category_id, 'spend', 'credit', -c.amount_pesewas
FROM transactions c
JOIN transaction_category tc ON tc.transaction_id = c.id
WHERE c.flow = 'credit' AND c.retracted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM reversal_links l
                  JOIN transactions o ON o.id = l.original_txn_id AND o.retracted_at IS NULL
                  WHERE l.credit_txn_id = c.id);
`;
