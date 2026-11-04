-- FG Compliance: Policy Library — policies, their versions (with approval) and staff acknowledgements.

CREATE TABLE IF NOT EXISTS compliance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  category VARCHAR(60) NOT NULL,
  owner VARCHAR(120) NOT NULL DEFAULT '',
  review_frequency VARCHAR(20) NOT NULL CHECK (review_frequency IN ('quarterly', 'six_monthly', 'annual', 'two_yearly')),
  -- The approved version currently in force (NULL until the first version is approved).
  current_version_id UUID,
  last_reviewed_at DATE,
  next_review_date DATE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_policies_title_idx ON compliance_policies (LOWER(title));

CREATE TABLE IF NOT EXISTS compliance_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  -- pending (submitted) → approved → superseded, or pending → rejected. Only approved versions are effective.
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  change_summary TEXT NOT NULL DEFAULT '',
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  -- File is stored encrypted on disk; sha256 is of the original bytes, for integrity checks.
  storage_path VARCHAR(255) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  submitted_by VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by VARCHAR(255),
  approved_on DATE,
  decided_at TIMESTAMPTZ,
  rejection_reason TEXT,
  UNIQUE (policy_id, version_number)
);

CREATE INDEX IF NOT EXISTS compliance_policy_versions_policy_idx ON compliance_policy_versions (policy_id);

-- At most one version awaiting approval per policy.
CREATE UNIQUE INDEX IF NOT EXISTS compliance_policy_versions_one_pending_idx
  ON compliance_policy_versions (policy_id) WHERE status = 'pending';

DO $fk$
BEGIN
  ALTER TABLE compliance_policies
    ADD CONSTRAINT compliance_policies_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES compliance_policy_versions(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$fk$;

CREATE TABLE IF NOT EXISTS compliance_policy_acknowledgements (
  version_id UUID NOT NULL REFERENCES compliance_policy_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (version_id, user_id)
);

ALTER TABLE compliance_policy_versions ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(255);
