-- Activities from the firm's "Compliance Activities Calendar" sheet that have been put on the compliance calendar.
-- Each is added once only, so an activity the Principal later edits or cancels is not added again.
CREATE TABLE IF NOT EXISTS compliance_calendar_activities_added (
  key VARCHAR(120) PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
