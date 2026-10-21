-- =============================================================================
-- PantaChat Phase 1: Database Schema Migration for Supabase
-- Run this in your Supabase SQL Editor:
-- =============================================================================

-- Add lifecycle resolution columns to the markets table
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'open' CHECK (resolution_status IN ('open', 'closed', 'proposed', 'resolved', 'disputed', 'void'));

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS proposed_outcome TEXT CHECK (proposed_outcome IN ('yes', 'no', 'void'));

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS dispute_until BIGINT;

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS evidence_url TEXT;

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS evidence_summary TEXT;

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;

ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS dispute_count INTEGER DEFAULT 0;

-- Optional: Create index on resolution_status and dispute_until for efficient background polling
CREATE INDEX IF NOT EXISTS idx_markets_resolution_status ON markets(resolution_status);
CREATE INDEX IF NOT EXISTS idx_markets_dispute_until ON markets(dispute_until);
