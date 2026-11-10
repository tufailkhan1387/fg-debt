-- Policy Library categories, managed in the app (shared by policies and procedures).
-- Seeded once, when the table is first created, so categories deleted later are not re-added on the next migrate.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_policy_categories') THEN
    CREATE TABLE compliance_policy_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(60) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX compliance_policy_categories_name_idx ON compliance_policy_categories (LOWER(name));

    INSERT INTO compliance_policy_categories (name)
    SELECT name FROM unnest(ARRAY[
      'Office Manual', 'Client Care', 'Complaints', 'Data Protection & Confidentiality', 'Anti-Money Laundering',
      'Safeguarding', 'Risk Management', 'Business Continuity', 'IT & Information Security',
      'People, Training & Supervision', 'Equality & Diversity', 'Finance', 'Other'
    ]) AS name;

    -- Keep any category already used by an entry.
    INSERT INTO compliance_policy_categories (name)
    SELECT DISTINCT ON (LOWER(category)) category FROM compliance_policies
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
