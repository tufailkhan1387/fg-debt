-- FG Compliance: digital file review checklist and supervision (spec section 8).
-- The checklist questions are the firm's own, entered by the Principal. A completed review is added to the
-- "File reviews" register and its corrective actions to the "Corrective actions" register.

CREATE TABLE IF NOT EXISTS compliance_file_review_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(120) NOT NULL DEFAULT 'General',
  question TEXT NOT NULL,
  guidance TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  -- Removed questions are archived: completed reviews keep their own copy of the wording.
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_file_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_ref VARCHAR(120) NOT NULL,
  matter_type VARCHAR(200) NOT NULL DEFAULT '',
  fee_earner VARCHAR(200) NOT NULL DEFAULT '',
  reviewer VARCHAR(200) NOT NULL DEFAULT '',
  review_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  -- Draft: [{questionId, answer, comment}]. Completed: the same plus the section and wording at the time.
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings TEXT NOT NULL DEFAULT '',
  -- Draft actions [{action, responsible, dueDate}]; on completion they become corrective action entries.
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  register_entry_id UUID REFERENCES compliance_register_entries(id) ON DELETE SET NULL,
  register_ref VARCHAR(20),
  action_entry_ids UUID[] NOT NULL DEFAULT '{}',
  created_by_id UUID,
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255),
  completed_by VARCHAR(255),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_file_reviews_status_idx ON compliance_file_reviews (status, review_date DESC);
