ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{"email":true,"sms":true,"ai":false,"marketing":false}'::jsonb;
