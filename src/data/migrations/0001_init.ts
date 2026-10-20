export const init = `
CREATE TABLE seen_messages (
  android_sms_id INTEGER PRIMARY KEY,
  received_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('parsed','unparsed','ignored')),
  ignore_reason TEXT,
  template_name TEXT,
  template_version INTEGER,
  parser_version INTEGER NOT NULL,
  momo_txn_id TEXT,
  CHECK (ignore_reason IS NULL OR status = 'ignored'),
  CHECK (status <> 'parsed' OR (momo_txn_id IS NOT NULL AND template_name IS NOT NULL AND template_version IS NOT NULL))
);
CREATE INDEX seen_txn ON seen_messages(momo_txn_id);
CREATE INDEX seen_status ON seen_messages(status);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  tint TEXT NOT NULL,
  system_key TEXT UNIQUE,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CHECK (is_system = (system_key IS NOT NULL))
);

CREATE TABLE keywords (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  value TEXT NOT NULL UNIQUE CHECK (value = lower(trim(value)) AND value <> ''),
  is_alias INTEGER NOT NULL DEFAULT 0 CHECK (is_alias IN (0,1))
);
CREATE INDEX kw_category ON keywords(category_id);

CREATE TABLE name_lists (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('family','friend')),
  value TEXT NOT NULL CHECK (value = lower(trim(value)) AND value <> ''),
  created_at INTEGER NOT NULL,
  UNIQUE (kind, value)
);

CREATE TABLE recipient_rules (
  id INTEGER PRIMARY KEY,
  match_field TEXT NOT NULL CHECK (match_field IN ('number','name')),
  match_value TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (match_field, match_value)
);
CREATE INDEX rule_category ON recipient_rules(category_id);

CREATE TABLE overrides (
  momo_txn_id TEXT PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  reference TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX override_category ON overrides(category_id);

CREATE TABLE transactions (
  momo_txn_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('sms','manual')),
  kind TEXT NOT NULL CHECK (kind IN (
    'payment_out','cash_out','transfer_out','payment_in','cash_in','interest','refund','reversal'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount_pesewas INTEGER NOT NULL CHECK (amount_pesewas >= 0),
  fee_pesewas INTEGER NOT NULL CHECK (fee_pesewas >= 0),
  tax_pesewas INTEGER NOT NULL CHECK (tax_pesewas >= 0),
  balance_after_pesewas INTEGER CHECK (balance_after_pesewas >= 0),
  counterparty_name TEXT,
  counterparty_number TEXT,
  merchant_code TEXT,
  reference TEXT,
  reference_source TEXT NOT NULL CHECK (reference_source IN ('sms','user','none')),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  category_source TEXT NOT NULL CHECK (category_source IN ('manual','rule','keyword','default')),
  is_self_transfer INTEGER NOT NULL DEFAULT 0 CHECK (is_self_transfer IN (0,1)),
  source_missing INTEGER NOT NULL DEFAULT 0 CHECK (source_missing IN (0,1)),
  reversed_by TEXT REFERENCES transactions(momo_txn_id) ON DELETE SET NULL,
  link_confidence TEXT CHECK (link_confidence IN ('exact','ambiguous')),
  conflict INTEGER NOT NULL DEFAULT 0 CHECK (conflict IN (0,1)),
  occurred_at INTEGER NOT NULL,
  occurred_at_source TEXT NOT NULL CHECK (occurred_at_source IN ('body','received','user')),
  template_name TEXT,
  template_version INTEGER,
  CHECK (source = 'manual' OR (template_name IS NOT NULL AND template_version IS NOT NULL)),
  CHECK ((source = 'manual') = (momo_txn_id LIKE 'manual:%')),
  CHECK ((source = 'manual') = (occurred_at_source = 'user'))
);
CREATE INDEX txn_time ON transactions(occurred_at DESC);
CREATE INDEX txn_cat_time ON transactions(category_id, occurred_at);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
