-- FG Compliance: central compliance registers (spec section 6). Field definitions live in code
-- (registers.catalog.ts); each entry stores its values as JSON.

CREATE TABLE IF NOT EXISTS compliance_register_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_key VARCHAR(40) NOT NULL,
  seq INT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- A NIL entry records that nothing happened in a period (e.g. "No complaints received in 2025").
  is_nil BOOLEAN NOT NULL DEFAULT FALSE,
  nil_period VARCHAR(60),
  nil_note TEXT,
  -- Restricted entries are visible only to the Principal, their author and the users listed.
  restricted BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_user_ids UUID[] NOT NULL DEFAULT '{}',
  -- Hash of the values, used to skip rows already imported.
  fingerprint VARCHAR(64) NOT NULL,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_by_id UUID,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (register_key, seq)
);

CREATE INDEX IF NOT EXISTS compliance_register_entries_register_idx ON compliance_register_entries (register_key);
