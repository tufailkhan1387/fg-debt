ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS custom_referral_partners JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referral_partner_patches JSONB NOT NULL DEFAULT '{}'::jsonb;
