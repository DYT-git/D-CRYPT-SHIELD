-- Migration 003: Add JSONB column for attribution results
-- This allows persisting the full list of ranked candidates and evidence from Phase 4
-- without creating many rigid schema tables that would need updating if evidence types change.

ALTER TABLE investigation_cases ADD COLUMN IF NOT EXISTS attribution_result JSONB;
