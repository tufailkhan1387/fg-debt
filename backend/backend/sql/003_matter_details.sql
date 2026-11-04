ALTER TABLE matters
  ADD COLUMN IF NOT EXISTS detail_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS matters_detail_data_gin_idx ON matters USING gin (detail_data);
