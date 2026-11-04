CREATE TABLE IF NOT EXISTS solicitor_notification_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS solicitor_notification_reads_user_idx
  ON solicitor_notification_reads (user_id);
