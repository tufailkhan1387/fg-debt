-- FG Compliance: AI analysis of each area (spec sections 6–12 "AI functions", Phase 4 regulatory impact).
-- Each run keeps what the AI said, the records it cited and any references that matched nothing; the Principal decides.

CREATE TABLE IF NOT EXISTS compliance_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  -- Regulatory impact runs: the update the Principal pasted in (as entered, before redaction).
  input_text TEXT,
  result JSONB NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  unknown_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_ai_insights_kind_idx ON compliance_ai_insights (kind, created_at DESC);
