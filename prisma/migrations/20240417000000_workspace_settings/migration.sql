-- ============================================================
-- Migration: workspace_settings
-- Adds workspace preferences and session tracking to UserSettings:
--   timezone    — IANA timezone string (e.g. "Europe/Paris")
--   currency    — ISO 4217 code (e.g. "EUR")
--   lastLoginIp — last known login IP for concurrent-session detection
-- ============================================================

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT;
