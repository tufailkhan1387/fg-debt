ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS custom_document_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS document_template_patches JSONB NOT NULL DEFAULT '{}'::jsonb;
