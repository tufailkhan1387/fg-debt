ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS firm_profile_patch JSONB NOT NULL DEFAULT '{}'::jsonb;
