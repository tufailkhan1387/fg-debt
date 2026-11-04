-- FG Compliance: staff training and competence (spec section 9). Training completed and hours come from the
-- "Staff training" register; this adds staff profiles, their competence records and the firm's required training.

CREATE TABLE IF NOT EXISTS compliance_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Matched (ignoring case) against the staff name in the training register.
  name VARCHAR(200) NOT NULL,
  position VARCHAR(120) NOT NULL DEFAULT '',
  start_date DATE,
  supervisor VARCHAR(200) NOT NULL DEFAULT '',
  supervision_requirements TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_staff_name_idx ON compliance_staff (LOWER(name));

CREATE TABLE IF NOT EXISTS compliance_staff_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES compliance_staff(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('qualification', 'induction', 'appraisal', 'development', 'certificate')),
  title VARCHAR(300) NOT NULL,
  record_date DATE,
  -- Qualification expiry, next appraisal due, or development objective target date.
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  -- Optional attached file (certificate), encrypted at rest.
  file_name VARCHAR(255),
  file_mime VARCHAR(120),
  file_size INT,
  storage_path VARCHAR(500),
  sha256 VARCHAR(64),
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_staff_records_staff_idx ON compliance_staff_records (staff_id);

-- The firm's own list of required training; never pre-filled.
CREATE TABLE IF NOT EXISTS compliance_required_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(200) NOT NULL,
  -- Empty means everyone; otherwise only staff in these positions.
  positions TEXT[] NOT NULL DEFAULT '{}',
  -- How often it must be repeated; NULL means once.
  every_months INT CHECK (every_months IS NULL OR every_months BETWEEN 1 AND 120),
  notes TEXT NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
