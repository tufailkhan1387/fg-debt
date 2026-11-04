-- FG Compliance: SQM (Specialist Quality Mark) checklist, Sections A–G.
-- The requirement wording is loaded by the firm from the official SQM standard; none is pre-filled here.

CREATE TABLE IF NOT EXISTS compliance_sqm_sections (
  letter CHAR(1) PRIMARY KEY CHECK (letter IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  -- Section heading as given in the SQM standard; empty until the firm enters it.
  title VARCHAR(200) NOT NULL DEFAULT ''
);

INSERT INTO compliance_sqm_sections (letter)
VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G')
ON CONFLICT (letter) DO NOTHING;

CREATE TABLE IF NOT EXISTS compliance_sqm_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section CHAR(1) NOT NULL REFERENCES compliance_sqm_sections(letter),
  ref VARCHAR(30) NOT NULL,
  requirement TEXT NOT NULL,
  -- Plain-English explanation of what the requirement asks for.
  meaning TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'not_assessed'
    CHECK (status IN ('not_assessed', 'not_met', 'partially_met', 'met', 'not_applicable')),
  outstanding_work TEXT NOT NULL DEFAULT '',
  responsible VARCHAR(120) NOT NULL DEFAULT '',
  review_date DATE,
  assessed_by VARCHAR(255),
  assessed_at TIMESTAMPTZ,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_sqm_requirements_ref_idx ON compliance_sqm_requirements (UPPER(ref));

-- The written policy or procedure behind a requirement (from the Policy Library).
CREATE TABLE IF NOT EXISTS compliance_sqm_requirement_policies (
  requirement_id UUID NOT NULL REFERENCES compliance_sqm_requirements(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  PRIMARY KEY (requirement_id, policy_id)
);

-- Evidence that the requirement is met in practice (kept apart from the written policy, spec section 4).
CREATE TABLE IF NOT EXISTS compliance_sqm_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES compliance_sqm_requirements(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Date the evidence relates to (e.g. date of the file review or training), not the upload date.
  evidence_date DATE NOT NULL,
  -- Optional attachment, stored encrypted like policy documents.
  file_name VARCHAR(255),
  mime_type VARCHAR(120),
  size_bytes INT,
  storage_path VARCHAR(255),
  sha256 VARCHAR(64),
  added_by VARCHAR(255) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_sqm_evidence_requirement_idx ON compliance_sqm_evidence (requirement_id);
