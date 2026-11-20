-- Reviews listed under Done on the Compliance Calendar come from the access log, which can never be changed.
-- Removing one from Done records its id here instead; the access log keeps the review.
CREATE TABLE IF NOT EXISTS compliance_done_removed (
  item_id VARCHAR(80) PRIMARY KEY,
  removed_by VARCHAR(255),
  removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
