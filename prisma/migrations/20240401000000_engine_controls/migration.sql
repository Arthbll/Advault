-- ============================================================
-- Migration: engine_controls
-- Adds the 4 Decision Engine control columns introduced in V1:
--   Campaign.excludeFromEngine  — exclude campaign from all engine actions
--   Campaign.automationPaused   — temporarily pause automation on this campaign
--   DecisionRule.engineMode     — "automatic" | "recommendation"
--   UserSettings.enginePausedUntil — global emergency-stop timestamp
--
-- Uses ADD COLUMN IF NOT EXISTS / DO $$ guards so it is safe to
-- run against a DB that already has these columns (e.g. dev DBs
-- set up with prisma db push after the schema was updated).
-- ============================================================

-- ── Campaign engine-control flags ────────────────────────────────────────────

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "excludeFromEngine" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "automationPaused" BOOLEAN NOT NULL DEFAULT false;

-- ── DecisionRule engine mode ──────────────────────────────────────────────────

ALTER TABLE "DecisionRule"
  ADD COLUMN IF NOT EXISTS "engineMode" TEXT NOT NULL DEFAULT 'automatic';

-- ── UserSettings emergency-stop ───────────────────────────────────────────────

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "enginePausedUntil" TIMESTAMPTZ;
