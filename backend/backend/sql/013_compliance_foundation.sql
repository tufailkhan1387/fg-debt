-- FG Compliance (Phase 1 foundation): access roles, module permissions, MFA and access/change log.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS compliance_role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

DO $chk$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_compliance_role_check
    CHECK (compliance_role IS NULL OR compliance_role IN ('principal', 'staff', 'viewer'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$chk$;

CREATE TABLE IF NOT EXISTS compliance_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(40) NOT NULL,
  access_level VARCHAR(10) NOT NULL CHECK (access_level IN ('none', 'view', 'edit')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module)
);

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id BIGSERIAL PRIMARY KEY,
  -- No FK: entries must outlive the user and the table rejects updates.
  user_id UUID,
  user_email VARCHAR(255),
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60),
  entity_id VARCHAR(120),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_audit_log_created_idx ON compliance_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_audit_log_user_idx ON compliance_audit_log (user_id);

-- The access log is append-only: block edits and deletes at the database level.
CREATE OR REPLACE FUNCTION compliance_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'compliance_audit_log is append-only';
END
$fn$;

DROP TRIGGER IF EXISTS compliance_audit_log_no_change ON compliance_audit_log;
CREATE TRIGGER compliance_audit_log_no_change
  BEFORE UPDATE OR DELETE ON compliance_audit_log
  FOR EACH ROW EXECUTE FUNCTION compliance_audit_log_immutable();
