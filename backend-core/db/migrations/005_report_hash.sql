-- Add report_hash to investigation_cases
ALTER TABLE investigation_cases ADD COLUMN IF NOT EXISTS report_hash TEXT;
