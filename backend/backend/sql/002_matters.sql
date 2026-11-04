CREATE TABLE IF NOT EXISTS matters (
  id VARCHAR(32) PRIMARY KEY,
  client_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_name VARCHAR(160) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  assigned_solicitor VARCHAR(160) NOT NULL,
  assigned_solicitor_email VARCHAR(255),
  status VARCHAR(40) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  vulnerability VARCHAR(40) NOT NULL DEFAULT 'none',
  total_debt NUMERIC(12, 2) NOT NULL DEFAULT 0,
  disposable_income NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ai_recommended_solution VARCHAR(160) NOT NULL,
  ai_confidence_score INTEGER NOT NULL DEFAULT 0,
  next_required_action TEXT,
  due_date DATE,
  has_urgent_pending_task BOOLEAN NOT NULL DEFAULT FALSE,
  has_task_sent_to_client BOOLEAN NOT NULL DEFAULT FALSE,
  documents_needing_review INTEGER NOT NULL DEFAULT 0,
  overdue_task_count INTEGER NOT NULL DEFAULT 0,
  created_at DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matters_solicitor_email_idx ON matters (assigned_solicitor_email);
CREATE INDEX IF NOT EXISTS matters_status_idx ON matters (status);
CREATE INDEX IF NOT EXISTS matters_updated_at_idx ON matters (updated_at DESC);
