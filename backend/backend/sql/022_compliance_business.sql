-- FG Compliance: financial and business compliance (spec section 10). Figures are entered by hand or
-- uploaded as spreadsheets; the system does not connect to Xero.

-- The recurring activities named in spec section 10, each with its own log of completed records.
CREATE TABLE IF NOT EXISTS compliance_business_activities (
  key VARCHAR(40) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  -- NULL when the spec gives no frequency; the Principal sets it.
  every_months INT CHECK (every_months IS NULL OR every_months BETWEEN 1 AND 60),
  next_due DATE,
  owner VARCHAR(200) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO compliance_business_activities (key, title, every_months, sort_order) VALUES
  ('business_plan', 'Annual Business Plan', 12, 1),
  ('business_plan_review', 'Six-monthly Business Plan review', 6, 2),
  ('budget', 'Annual budget', 12, 3),
  ('variance_report', 'Quarterly financial variance report', 3, 4),
  ('financial_review', 'Six-monthly financial review', 6, 5),
  ('business_continuity', 'Business continuity planning', NULL, 6),
  ('compliance_review', 'Annual compliance review', 12, 7)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS compliance_business_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_key VARCHAR(40) NOT NULL REFERENCES compliance_business_activities(key),
  period VARCHAR(80) NOT NULL DEFAULT '',
  completed_date DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  file_name VARCHAR(255),
  file_mime VARCHAR(120),
  file_size INT,
  storage_path VARCHAR(500),
  sha256 VARCHAR(64),
  signed_off_by VARCHAR(255),
  signed_off_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_business_records_activity_idx ON compliance_business_records (activity_key, completed_date DESC);

CREATE TABLE IF NOT EXISTS compliance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  -- First day of the financial year; quarters run in three-month steps from here.
  start_date DATE NOT NULL,
  -- Variances above this percentage are flagged; NULL means none are flagged.
  threshold_pct NUMERIC(6, 2),
  notes TEXT NOT NULL DEFAULT '',
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_budgets_name_idx ON compliance_budgets (LOWER(name));

CREATE TABLE IF NOT EXISTS compliance_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES compliance_budgets(id) ON DELETE CASCADE,
  category VARCHAR(200) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('income', 'expense')),
  budget_q NUMERIC(14, 2)[] NOT NULL DEFAULT '{0,0,0,0}',
  -- NULL for a quarter whose actual figure has not been entered.
  actual_q NUMERIC(14, 2)[] NOT NULL DEFAULT '{NULL,NULL,NULL,NULL}',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS compliance_budget_lines_budget_idx ON compliance_budget_lines (budget_id);

CREATE TABLE IF NOT EXISTS compliance_budget_quarters (
  budget_id UUID NOT NULL REFERENCES compliance_budgets(id) ON DELETE CASCADE,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  commentary TEXT NOT NULL DEFAULT '',
  -- Explanations for individual lines, keyed by line id.
  line_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_off_by VARCHAR(255),
  signed_off_at TIMESTAMPTZ,
  record_id UUID REFERENCES compliance_business_records(id) ON DELETE SET NULL,
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (budget_id, quarter)
);
