// Source of truth for the shape and the reasons is docs/data-model.md.
//
// A budget plan is a span of days with a total the user means to stay inside, and optionally a
// limit per category. Nothing here stores spending: spend against a plan is always read from
// ledger_lines over the plan's days, so a late refund or a new category tag updates it for free.
export const budgets = `
CREATE TABLE budget_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT CHECK (name IS NULL OR (name <> '' AND name = trim(name))),
  start_day     TEXT NOT NULL CHECK (start_day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  end_day       TEXT NOT NULL CHECK (end_day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  total_pesewas INTEGER NOT NULL CHECK (total_pesewas > 0),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  CHECK (end_day >= start_day)
) STRICT;

CREATE TABLE budget_limits (
  plan_id       INTEGER NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  limit_pesewas INTEGER NOT NULL CHECK (limit_pesewas > 0),
  PRIMARY KEY (plan_id, category_id)
) STRICT;
CREATE INDEX budget_limits_category ON budget_limits(category_id);

-- Triggers, not foreign keys or CHECKs, hold the rules that look at other rows: foreign_keys can
-- be OFF on a connection, and a CHECK cannot read another table.
CREATE TRIGGER budget_plans_no_overlap_insert
BEFORE INSERT ON budget_plans
WHEN EXISTS (SELECT 1 FROM budget_plans WHERE start_day <= NEW.end_day AND end_day >= NEW.start_day)
BEGIN
  SELECT RAISE(ABORT, 'plans cannot overlap');
END;

CREATE TRIGGER budget_plans_no_overlap_update
BEFORE UPDATE OF start_day, end_day ON budget_plans
WHEN EXISTS (SELECT 1 FROM budget_plans
             WHERE id <> OLD.id AND start_day <= NEW.end_day AND end_day >= NEW.start_day)
BEGIN
  SELECT RAISE(ABORT, 'plans cannot overlap');
END;

CREATE TRIGGER budget_plans_total_floor
BEFORE UPDATE OF total_pesewas ON budget_plans
WHEN COALESCE((SELECT SUM(limit_pesewas) FROM budget_limits WHERE plan_id = OLD.id), 0)
     > NEW.total_pesewas
BEGIN
  SELECT RAISE(ABORT, 'limits exceed the plan total');
END;

CREATE TRIGGER budget_limits_cap_insert
BEFORE INSERT ON budget_limits
WHEN COALESCE((SELECT SUM(limit_pesewas) FROM budget_limits WHERE plan_id = NEW.plan_id), 0)
     + NEW.limit_pesewas
     > COALESCE((SELECT total_pesewas FROM budget_plans WHERE id = NEW.plan_id), 0)
BEGIN
  SELECT RAISE(ABORT, 'limits exceed the plan total');
END;

CREATE TRIGGER budget_limits_cap_update
BEFORE UPDATE OF plan_id, limit_pesewas ON budget_limits
WHEN COALESCE((SELECT SUM(limit_pesewas) FROM budget_limits
               WHERE plan_id = NEW.plan_id AND category_id <> OLD.category_id), 0)
     + NEW.limit_pesewas
     > COALESCE((SELECT total_pesewas FROM budget_plans WHERE id = NEW.plan_id), 0)
BEGIN
  SELECT RAISE(ABORT, 'limits exceed the plan total');
END;

CREATE TRIGGER budget_limits_not_income
BEFORE INSERT ON budget_limits
WHEN (SELECT system_key FROM categories WHERE id = NEW.category_id) = 'income'
BEGIN
  SELECT RAISE(ABORT, 'income takes no limit');
END;
`;
