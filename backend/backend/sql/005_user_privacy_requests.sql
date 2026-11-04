ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_requests JSONB NOT NULL DEFAULT '{"dataExports":[],"accountClosure":null}'::jsonb;
