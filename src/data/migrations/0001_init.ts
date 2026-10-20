// Source of truth for the shape and the reasons is docs/data-model.md.
//
// Money is INTEGER pesewas, times are INTEGER epoch ms UTC, booleans are INTEGER 0/1.
// Every table is STRICT so a REAL such as 10.5 can never land in a money column.
// CHECK constraints guard closed sets only; sets that grow with the parser (kind, ignore
// reason, category source) are TS unions because SQLite cannot alter a CHECK without a rebuild.
// Connection pragmas are not set here: they cannot run inside the migration's transaction.
export const init = `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,  -- AUTOINCREMENT: an id is never reused after delete
  system_key   TEXT UNIQUE,                        -- 'food','misc','cash',...; NULL for user-made
  name         TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  color        TEXT NOT NULL CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  tint         TEXT NOT NULL CHECK (tint  GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  sort_order   INTEGER NOT NULL DEFAULT 0,         -- display order and keyword tie-break priority
  seed_version INTEGER,                            -- seed version that introduced the row; NULL for user-made
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
) STRICT;

-- The categoriser and the UI depend on these five existing, so they belong to the schema, not the seed.
INSERT INTO categories (system_key, name, color, tint, sort_order, seed_version, created_at, updated_at) VALUES
  ('family',  'Family',  '#EDA100', '#FBEBC4',  40, 1, 0, 0),
  ('friends', 'Friends', '#2A78D6', '#D9E8FA',  50, 1, 0, 0),
  ('income',  'Income',  '#1F7A4D', '#D6F1E6', 100, 1, 0, 0),
  ('cash',    'Cash',    '#444444', '#E4E4E4', 900, 1, 0, 0),
  ('misc',    'Misc',    '#9A9A9A', '#EDEDED', 999, 1, 0, 0);

-- These triggers matter because foreign_keys can be OFF on a connection (expo-sqlite opens
-- some connections that way), and then no foreign key would stop the delete.
CREATE TRIGGER categories_protect_delete
BEFORE DELETE ON categories
WHEN OLD.system_key IN ('family','friends','cash','income','misc')
BEGIN
  SELECT RAISE(ABORT, 'protected category cannot be deleted');
END;

CREATE TRIGGER categories_protect_key
BEFORE UPDATE OF system_key ON categories
WHEN OLD.system_key IS NOT NEW.system_key
BEGIN
  SELECT RAISE(ABORT, 'system_key is immutable');
END;

-- Values are stored normalised: lowercase, trimmed, single spaces. One word, one category.
CREATE TABLE keywords (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  value       TEXT NOT NULL UNIQUE
              CHECK (value <> '' AND value = lower(trim(value)) AND value NOT LIKE '%  %'),
  is_alias    INTEGER NOT NULL DEFAULT 0 CHECK (is_alias IN (0,1)),
  origin      TEXT NOT NULL CHECK (origin IN ('seed','user')),
  created_at  INTEGER NOT NULL
) STRICT;
CREATE INDEX keywords_category ON keywords(category_id);

CREATE TABLE name_lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('family','friend')),
  value      TEXT NOT NULL UNIQUE
             CHECK (value <> '' AND value = lower(trim(value)) AND value NOT LIKE '%  %'),
  created_at INTEGER NOT NULL
) STRICT;

-- applies_to scopes a rule to one money flow, so tagging payments TO Maa as Family does not
-- turn money FROM Maa into Family spend.
CREATE TABLE recipient_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_field TEXT NOT NULL CHECK (match_field IN ('number','merchant_code','name')),
  match_value TEXT NOT NULL CHECK (match_value <> ''),
  applies_to  TEXT NOT NULL CHECK (applies_to IN ('spend','income')),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (match_field, match_value, applies_to)
) STRICT;
CREATE INDEX recipient_rules_category ON recipient_rules(category_id);

-- One row per inbox message identity. No message text, ever. Android can reuse the id of a
-- deleted newest SMS, so identity is (android_sms_id, received_at). Rows are never deleted: a
-- message that leaves the inbox gets gone_at, and a reused id gets a new row.
CREATE TABLE sms_messages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  android_sms_id INTEGER NOT NULL CHECK (android_sms_id > 0),
  received_at    INTEGER NOT NULL,
  sender         TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('parsed','ignored','unparsed','error')),
  reason         TEXT,                              -- ignore reason or error code
  parser_version INTEGER NOT NULL,
  first_seen_at  INTEGER NOT NULL,
  parsed_at      INTEGER NOT NULL,
  gone_at        INTEGER,
  UNIQUE (android_sms_id, received_at),
  CHECK ((status IN ('ignored','error')) = (reason IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX sms_messages_live_id ON sms_messages(android_sms_id) WHERE gone_at IS NULL;
CREATE INDEX sms_messages_review ON sms_messages(status) WHERE status IN ('unparsed','error');

CREATE TRIGGER sms_messages_no_delete
BEFORE DELETE ON sms_messages
BEGIN
  SELECT RAISE(ABORT, 'sms_messages rows are never deleted; set gone_at');
END;

CREATE TRIGGER sms_messages_identity_immutable
BEFORE UPDATE OF android_sms_id, received_at ON sms_messages
WHEN OLD.android_sms_id IS NOT NEW.android_sms_id OR OLD.received_at IS NOT NEW.received_at
BEGIN
  SELECT RAISE(ABORT, 'message identity is immutable; insert a new row');
END;

-- Kept apart from status so a re-parse that still fails cannot resurrect a dismissed message.
CREATE TABLE message_dismissals (
  message_id   INTEGER PRIMARY KEY REFERENCES sms_messages(id),
  dismissed_at INTEGER NOT NULL
) STRICT;

-- origin 'sms': a fold (mergeAll) of every sms_fragments row sharing the momo_txn_id, plus the
--   categoriser output. Never deleted (trigger); a row left with no fragments gets retracted_at.
-- origin 'manual': "Add expense" and "Add by hand"; every field is user-entered.
-- flow is the accounting meaning and the only thing totals look at:
--   spend = money out (self-transfers included), income = money in, credit = reversal or refund
--   (never income; offsets spend, see ledger_lines).
-- auto_category_* is the categoriser's output and is overwritten freely by recategorise. The
-- user's tag lives only in transaction_annotations.category_id.
CREATE TABLE transactions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  origin                TEXT NOT NULL CHECK (origin IN ('sms','manual')),
  momo_txn_id           TEXT UNIQUE,
  source_message_id     INTEGER UNIQUE REFERENCES sms_messages(id),
  flow                  TEXT NOT NULL CHECK (flow IN ('spend','income','credit')),
  kind                  TEXT NOT NULL,
  amount_pesewas        INTEGER NOT NULL CHECK (amount_pesewas >= 0),
  fee_pesewas           INTEGER NOT NULL DEFAULT 0 CHECK (fee_pesewas >= 0),
  tax_pesewas           INTEGER NOT NULL DEFAULT 0 CHECK (tax_pesewas >= 0),
  balance_after_pesewas INTEGER,
  counterparty_name     TEXT,                       -- manual rows: the "What was it for?" title
  merchant_code         TEXT,
  counterparty_number   TEXT,
  sms_reference         TEXT,
  reference_clean       TEXT,
  auto_category_id      INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  auto_category_source  TEXT,                       -- rule | keyword | default
  is_self_transfer      INTEGER NOT NULL DEFAULT 0 CHECK (is_self_transfer IN (0,1)),
  has_conflict          INTEGER NOT NULL DEFAULT 0 CHECK (has_conflict IN (0,1)),
  occurred_at           INTEGER NOT NULL,
  occurred_at_source    TEXT NOT NULL CHECK (occurred_at_source IN ('body','received','user')),
  retracted_at          INTEGER,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  CHECK ((origin = 'sms') = (momo_txn_id IS NOT NULL)),
  CHECK (origin = 'manual' OR source_message_id IS NULL),
  CHECK (origin = 'sms' OR (retracted_at IS NULL AND occurred_at_source = 'user')),
  CHECK (origin = 'manual' OR occurred_at_source <> 'user'),
  CHECK ((auto_category_id IS NULL) = (auto_category_source IS NULL)),
  CHECK (origin = 'manual' OR auto_category_id IS NOT NULL)
) STRICT;
CREATE INDEX transactions_time     ON transactions(occurred_at);
CREATE INDEX transactions_cat_time ON transactions(auto_category_id, occurred_at);

CREATE TRIGGER transactions_sms_no_delete
BEFORE DELETE ON transactions
WHEN OLD.origin = 'sms'
BEGIN
  SELECT RAISE(ABORT, 'sms transactions are never deleted; set retracted_at');
END;

CREATE TRIGGER transactions_identity_immutable
BEFORE UPDATE OF origin, momo_txn_id ON transactions
WHEN OLD.origin IS NOT NEW.origin OR OLD.momo_txn_id IS NOT NEW.momo_txn_id
BEGIN
  SELECT RAISE(ABORT, 'transaction identity is immutable');
END;

-- What ONE message said about its transaction. A transaction is always mergeAll(fragments),
-- so a re-parse can drop a wrongly parsed value instead of letting non-null win forever.
CREATE TABLE sms_fragments (
  message_id            INTEGER PRIMARY KEY REFERENCES sms_messages(id),
  momo_txn_id           TEXT NOT NULL REFERENCES transactions(momo_txn_id) DEFERRABLE INITIALLY DEFERRED,
  flow                  TEXT NOT NULL CHECK (flow IN ('spend','income','credit')),
  kind                  TEXT NOT NULL,
  amount_pesewas        INTEGER NOT NULL CHECK (amount_pesewas >= 0),
  fee_pesewas           INTEGER CHECK (fee_pesewas >= 0),          -- NULL = message does not say; 0 = says zero
  tax_pesewas           INTEGER CHECK (tax_pesewas >= 0),
  balance_after_pesewas INTEGER,
  counterparty_name     TEXT,
  merchant_code         TEXT,
  counterparty_number   TEXT,
  reference             TEXT,
  occurred_at           INTEGER NOT NULL,
  occurred_at_source    TEXT NOT NULL CHECK (occurred_at_source IN ('body','received')),
  template_name         TEXT NOT NULL,
  template_version      INTEGER NOT NULL
) STRICT;
CREATE INDEX sms_fragments_txn ON sms_fragments(momo_txn_id);

-- User-owned edits, written only by user actions. Deleting a category clears category_id
-- (SET NULL) and keeps the note. note NULL = use the SMS reference; note '' = the user cleared it.
CREATE TABLE transaction_annotations (
  transaction_id        INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  note                  TEXT CHECK (note IS NULL OR note = trim(note)),
  prompt_snoozed_until  INTEGER,
  updated_at            INTEGER NOT NULL
) STRICT;
CREATE INDEX transaction_annotations_category ON transaction_annotations(category_id);

-- One row per credit; an original may have several (partial refunds). linked_by 'user' rows
-- are never touched by the auto-linker; a user row with original_txn_id NULL means "no original".
CREATE TABLE reversal_links (
  credit_txn_id   INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  original_txn_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  linked_by       TEXT NOT NULL CHECK (linked_by IN ('auto','user')),
  confidence      TEXT CHECK (confidence IN ('exact','ambiguous')),
  created_at      INTEGER NOT NULL,
  CHECK (credit_txn_id <> original_txn_id),
  CHECK (linked_by = 'user' OR (original_txn_id IS NOT NULL AND confidence IS NOT NULL))
) STRICT;
CREATE INDEX reversal_links_original ON reversal_links(original_txn_id);

CREATE TRIGGER reversal_links_shape_insert
BEFORE INSERT ON reversal_links
WHEN (SELECT flow FROM transactions WHERE id = NEW.credit_txn_id) IS NOT 'credit'
  OR (NEW.original_txn_id IS NOT NULL
      AND (SELECT flow FROM transactions WHERE id = NEW.original_txn_id) IS NOT 'spend')
BEGIN
  SELECT RAISE(ABORT, 'a link joins a credit to a spend row');
END;

CREATE TRIGGER reversal_links_shape_update
BEFORE UPDATE OF credit_txn_id, original_txn_id ON reversal_links
WHEN (SELECT flow FROM transactions WHERE id = NEW.credit_txn_id) IS NOT 'credit'
  OR (NEW.original_txn_id IS NOT NULL
      AND (SELECT flow FROM transactions WHERE id = NEW.original_txn_id) IS NOT 'spend')
BEGIN
  SELECT RAISE(ABORT, 'a link joins a credit to a spend row');
END;

-- Effective category: the user's tag, else the categoriser's, else Misc. Each candidate is
-- looked up in categories, so an id that points at a deleted row (foreign_keys OFF) falls
-- through instead of surviving as a dangling id.
CREATE VIEW transaction_category AS
SELECT t.id AS transaction_id,
       COALESCE(ca.id, cu.id, misc.id) AS category_id
FROM transactions t
LEFT JOIN transaction_annotations a ON a.transaction_id = t.id
LEFT JOIN categories ca   ON ca.id = a.category_id
LEFT JOIN categories cu   ON cu.id = t.auto_category_id
LEFT JOIN categories misc ON misc.system_key = 'misc';

-- The accounting rule, in one place. Every total is one SUM over [at >= start AND at < end],
-- optionally by category_id:
--   spend   = SUM(pesewas) WHERE bucket = 'spend'   (amounts + charges - refunds)
--   income  = SUM(pesewas) WHERE bucket = 'income'
--   charges = SUM(pesewas) WHERE part = 'charge'    (fees and tax; a subset of spend)
-- A linked credit offsets the original's month and category. Per original the offset is
-- MIN(original amount, sum of its credits), so an over-refund never drives a category
-- negative, and fees the reversal did not return stay counted. That row carries the
-- original's transaction_id. A credit with no live original offsets its own month and category.
CREATE VIEW ledger_lines AS
SELECT t.id AS transaction_id, t.occurred_at AS at, tc.category_id,
       'spend' AS bucket, 'amount' AS part, t.amount_pesewas AS pesewas
FROM transactions t
JOIN transaction_category tc ON tc.transaction_id = t.id
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

-- What list, detail and search read. Hides retracted rows and resolves user-over-SMS fields.
CREATE VIEW transaction_list AS
SELECT t.id,
       t.origin,
       t.momo_txn_id,
       t.flow,
       CASE t.flow WHEN 'spend' THEN 'out' ELSE 'in' END            AS direction,
       t.kind,
       t.amount_pesewas, t.fee_pesewas, t.tax_pesewas, t.balance_after_pesewas,
       COALESCE(t.counterparty_name,
                CASE WHEN t.merchant_code IS NOT NULL THEN 'Merchant ' || t.merchant_code END) AS counterparty,
       t.counterparty_number,
       tc.category_id,
       CASE WHEN ca.id IS NOT NULL THEN 'manual' ELSE t.auto_category_source END AS category_source,
       CASE WHEN a.note = '' THEN NULL ELSE COALESCE(a.note, t.reference_clean) END AS note,
       CASE WHEN a.note = '' THEN NULL
            WHEN a.note IS NOT NULL THEN 'user'
            WHEN t.reference_clean IS NOT NULL THEN 'sms' END       AS note_source,
       a.prompt_snoozed_until,
       t.is_self_transfer,
       t.has_conflict,
       t.occurred_at,
       t.occurred_at_source,
       l.original_txn_id                                            AS reverses_txn_id,
       l.confidence                                                 AS link_confidence,
       EXISTS (SELECT 1 FROM reversal_links r
               JOIN transactions c ON c.id = r.credit_txn_id AND c.retracted_at IS NULL
               WHERE r.original_txn_id = t.id)                      AS is_reversed,
       CASE WHEN t.origin = 'sms' THEN
         EXISTS (SELECT 1 FROM sms_fragments f
                 JOIN sms_messages m ON m.id = f.message_id AND m.gone_at IS NULL
                 WHERE f.momo_txn_id = t.momo_txn_id) END           AS source_on_phone
FROM transactions t
JOIN transaction_category tc        ON tc.transaction_id = t.id
LEFT JOIN transaction_annotations a ON a.transaction_id = t.id
LEFT JOIN categories ca             ON ca.id = a.category_id
LEFT JOIN reversal_links l          ON l.credit_txn_id = t.id
WHERE t.retracted_at IS NULL;

-- "Messages we couldn't read": still on the phone, not parsed, not dismissed, not typed in by hand.
CREATE VIEW unread_messages AS
SELECT m.id, m.android_sms_id, m.received_at, m.status, m.reason
FROM sms_messages m
WHERE m.status IN ('unparsed','error')
  AND m.gone_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM message_dismissals d WHERE d.message_id = m.id)
  AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.source_message_id = m.id);
`;
