-- When the Principal marks a register entry reviewed, they set the date of its next review.
-- The calendar and dashboard then show that date instead of the entry's original deadline.
ALTER TABLE compliance_register_entries ADD COLUMN IF NOT EXISTS next_review_date DATE;
