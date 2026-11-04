-- FG Compliance: firm-wide Risk Register (mirrors the "Risk Register" sheet of the Master Register workbook).

CREATE TABLE IF NOT EXISTS compliance_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref VARCHAR(20) NOT NULL,
  name TEXT NOT NULL,
  category VARCHAR(40) NOT NULL,
  likelihood VARCHAR(40) NOT NULL CHECK (likelihood IN ('unlikely', 'occasional', 'almost_certain')),
  impact VARCHAR(40) NOT NULL CHECK (impact IN ('minimal', 'noticeable', 'significant')),
  -- Inherent level is always derived from likelihood x impact (same matrix as the workbook's Setup sheet).
  risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  controls TEXT NOT NULL DEFAULT '',
  residual_level VARCHAR(10) NOT NULL CHECK (residual_level IN ('low', 'medium', 'high')),
  further_action TEXT NOT NULL DEFAULT '',
  review_frequency VARCHAR(20) NOT NULL CHECK (review_frequency IN ('monthly', 'quarterly', 'annual')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'monitoring', 'closed')),
  owner VARCHAR(120) NOT NULL DEFAULT '',
  last_reviewed_at TIMESTAMPTZ,
  next_review_date DATE,
  -- The Principal must approve risk ratings (spec section 7).
  approval_status VARCHAR(20) NOT NULL CHECK (approval_status IN ('pending', 'approved')),
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_risks_ref_idx ON compliance_risks (UPPER(ref));
