-- FG Compliance: the firm's structured appraisal form (Master Register "Performance Evaluation" sheet),
-- kept on the appraisal record it belongs to.
ALTER TABLE compliance_staff_records ADD COLUMN IF NOT EXISTS form JSONB;
