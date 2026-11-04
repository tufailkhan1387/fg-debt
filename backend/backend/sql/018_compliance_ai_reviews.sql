-- FG Compliance: AI document reviews. The AI suggests; people decide (spec sections 3 and 15).

CREATE TABLE IF NOT EXISTS compliance_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- upload: a document uploaded for review (stored encrypted); policy: a version from the Policy Library.
  source VARCHAR(20) NOT NULL CHECK (source IN ('upload', 'policy')),
  policy_id UUID REFERENCES compliance_policies(id) ON DELETE SET NULL,
  policy_version_id UUID REFERENCES compliance_policy_versions(id) ON DELETE SET NULL,
  document_type VARCHAR(80) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(255),
  sha256 VARCHAR(64),
  -- What the document was checked against: [{ id, kind: 'sqm' | 'custom', label, text }].
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  redacted BOOLEAN NOT NULL,
  redactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  provider VARCHAR(60) NOT NULL,
  model VARCHAR(80) NOT NULL,
  input_chars INT,
  usage JSONB,
  draft_status VARCHAR(20) CHECK (draft_status IN ('running', 'completed', 'failed')),
  draft_text TEXT,
  draft_error TEXT,
  draft_generated_at TIMESTAMPTZ,
  draft_submitted_version_id UUID REFERENCES compliance_policy_versions(id) ON DELETE SET NULL,
  requested_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS compliance_ai_reviews_created_idx ON compliance_ai_reviews (created_at DESC);
