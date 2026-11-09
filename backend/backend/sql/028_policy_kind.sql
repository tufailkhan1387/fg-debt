-- Policy Library entries are either a policy or a procedure. Existing entries are policies.
ALTER TABLE compliance_policies
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'policy' CHECK (kind IN ('policy', 'procedure'));
