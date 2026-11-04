ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS workflow_patches JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reminder_patches JSONB NOT NULL DEFAULT '{}'::jsonb;
