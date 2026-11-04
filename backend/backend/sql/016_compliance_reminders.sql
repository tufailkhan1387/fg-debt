-- FG Compliance: compliance calendar tasks (one-off or recurring) and the daily email digest record.

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Occurrences of the same recurring activity share a series id.
  series_id UUID NOT NULL DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  area VARCHAR(60) NOT NULL,
  owner VARCHAR(120) NOT NULL DEFAULT '',
  due_date DATE NOT NULL,
  recurrence VARCHAR(20) NOT NULL CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'six_monthly', 'annual')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(255),
  completion_note TEXT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_tasks_open_due_idx ON compliance_tasks (due_date) WHERE status = 'open';

-- One digest per recipient per day, so restarts or several API instances never send twice.
CREATE TABLE IF NOT EXISTS compliance_reminder_digests (
  id BIGSERIAL PRIMARY KEY,
  digest_date DATE NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  item_count INT NOT NULL,
  -- sent: emailed; logged: no mail server configured (development), written to the server log instead;
  -- skipped: nothing due; failed: the mail server refused it.
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'logged', 'skipped', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (digest_date, recipient)
);
