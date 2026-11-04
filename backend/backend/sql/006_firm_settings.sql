CREATE TABLE IF NOT EXISTS firm_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  custom_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_patches JSONB NOT NULL DEFAULT '{}'::jsonb,
  integration_patches JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO firm_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
