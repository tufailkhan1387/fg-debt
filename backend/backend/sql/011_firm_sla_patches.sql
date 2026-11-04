ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS sla_patches JSONB NOT NULL DEFAULT '{}'::jsonb;
