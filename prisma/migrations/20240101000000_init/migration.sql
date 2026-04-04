-- ============================================================
-- Migration: init
-- Baseline schema — covers everything built in ProfitDash V1
-- Uses IF NOT EXISTS / DO $$ guards so it is safe to apply
-- against a DB that was previously set up with prisma db push.
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "Network" AS ENUM (
    'EXOCLICK', 'TRAFFICSTARS', 'TRAFFICJUNKY', 'VOLUUM', 'BEMOB'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM (
    'ACTIVE', 'PAUSED', 'KILLED', 'WATCH', 'DRAFT', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LogType" AS ENUM (
    'SYNC',
    'KILL_SWITCH_TRIGGERED', 'KILL_SWITCH_PAUSED', 'KILL_SWITCH_RESTORED',
    'CAMPAIGN_ACTION', 'AUTH_ERROR', 'API_ERROR', 'BUDGET_ALERT',
    'DECISION_KILL', 'DECISION_WATCH', 'DECISION_SCALE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add enum values that may be missing on older DBs
DO $$ BEGIN
  ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'WATCH';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'DECISION_KILL';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'DECISION_WATCH';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'DECISION_SCALE';
EXCEPTION WHEN others THEN NULL; END $$;

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "User" (
  "id"        TEXT        NOT NULL,
  "email"     TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "User_pkey"  PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "TeamInvite" (
  "id"        TEXT        NOT NULL,
  "ownerId"   TEXT        NOT NULL,
  "email"     TEXT        NOT NULL,
  "token"     TEXT        NOT NULL,
  "role"      TEXT        NOT NULL DEFAULT 'member',
  "status"    TEXT        NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TeamInvite_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "TeamInvite_token_key" UNIQUE ("token")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id"        TEXT        NOT NULL,
  "ownerId"   TEXT        NOT NULL,
  "memberId"  TEXT        NOT NULL,
  "role"      TEXT        NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TeamMember_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "TeamMember_memberId_key" UNIQUE ("memberId")
);

CREATE TABLE IF NOT EXISTS "Account" (
  "id"           TEXT        NOT NULL,
  "userId"       TEXT        NOT NULL,
  "network"      "Network"   NOT NULL,
  "apiKeyEnc"    TEXT        NOT NULL,
  "apiSecretEnc" TEXT,
  "label"        TEXT,
  "isActive"     BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Account_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "Account_userId_network_key" UNIQUE ("userId", "network")
);

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"          TEXT              NOT NULL,
  "userId"      TEXT              NOT NULL,
  "accountId"   TEXT              NOT NULL,
  "externalId"  TEXT              NOT NULL,
  "name"        TEXT              NOT NULL,
  "network"     "Network"         NOT NULL,
  "status"      "CampaignStatus"  NOT NULL DEFAULT 'ACTIVE',
  "spend"       DECIMAL(12,4)     NOT NULL DEFAULT 0,
  "revenue"     DECIMAL(12,4)     NOT NULL DEFAULT 0,
  "impressions" INTEGER           NOT NULL DEFAULT 0,
  "clicks"      INTEGER           NOT NULL DEFAULT 0,
  "conversions" INTEGER           NOT NULL DEFAULT 0,
  "excludeFromEngine" BOOLEAN     NOT NULL DEFAULT false,
  "automationPaused"  BOOLEAN     NOT NULL DEFAULT false,
  "dateFrom"    TIMESTAMPTZ       NOT NULL,
  "dateTo"      TIMESTAMPTZ       NOT NULL,
  "syncedAt"    TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "createdAt"   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Campaign_accountId_externalId_dateFrom_dateTo_key"
    UNIQUE ("accountId", "externalId", "dateFrom", "dateTo")
);

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id"                   TEXT        NOT NULL,
  "userId"               TEXT        NOT NULL,
  "killSwitchEnabled"    BOOLEAN     NOT NULL DEFAULT false,
  "spendOnlyMode"        BOOLEAN     NOT NULL DEFAULT false,
  "roiThreshold"         DOUBLE PRECISION NOT NULL DEFAULT -50,
  "maxSpendPerCampaign"  DOUBLE PRECISION,
  "checkIntervalMinutes" INTEGER     NOT NULL DEFAULT 30,
  "budgetAlertEnabled"   BOOLEAN     NOT NULL DEFAULT false,
  "dailyBudgetLimit"     DOUBLE PRECISION,
  "enginePausedUntil"    TIMESTAMPTZ,
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserSettings_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "UserSettings_userId_key" UNIQUE ("userId")
);

CREATE TABLE IF NOT EXISTS "Conversion" (
  "id"         TEXT        NOT NULL,
  "userId"     TEXT        NOT NULL,
  "campaignId" TEXT,
  "clickId"    TEXT,
  "revenue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"   TEXT        NOT NULL DEFAULT 'USD',
  "source"     TEXT,
  "ip"         TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DecisionRule" (
  "id"             TEXT             NOT NULL,
  "userId"         TEXT             NOT NULL,
  "preset"         TEXT             NOT NULL DEFAULT 'balanced',
  "engineMode"     TEXT             NOT NULL DEFAULT 'automatic',
  "killRoi"        DOUBLE PRECISION NOT NULL DEFAULT -30,
  "watchLow"       DOUBLE PRECISION NOT NULL DEFAULT -15,
  "watchHigh"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scaleRoi"       DOUBLE PRECISION NOT NULL DEFAULT 30,
  "scaleIncrement" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "minSpend"       DOUBLE PRECISION NOT NULL DEFAULT 20,
  "minConversions" INTEGER          NOT NULL DEFAULT 3,
  "killHoldMin"    INTEGER          NOT NULL DEFAULT 30,
  "scaleHoldMin"   INTEGER          NOT NULL DEFAULT 60,
  "killCooldownH"  INTEGER          NOT NULL DEFAULT 3,
  "scaleCooldownH" INTEGER          NOT NULL DEFAULT 6,
  "maxKillsDay"    INTEGER          NOT NULL DEFAULT 5,
  "maxScalesDay"   INTEGER          NOT NULL DEFAULT 2,
  "updatedAt"      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "createdAt"      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "DecisionRule_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "DecisionRule_userId_key" UNIQUE ("userId")
);

CREATE TABLE IF NOT EXISTS "Log" (
  "id"         TEXT        NOT NULL,
  "userId"     TEXT        NOT NULL,
  "campaignId" TEXT,
  "type"       "LogType"   NOT NULL,
  "message"    TEXT        NOT NULL,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys ──────────────────────────────────────────────────────────────

ALTER TABLE "TeamInvite"  ADD CONSTRAINT "TeamInvite_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE
  NOT VALID;  -- NOT VALID = safe on existing data

ALTER TABLE "TeamMember"  ADD CONSTRAINT "TeamMember_ownerId_fkey"
  FOREIGN KEY ("ownerId")  REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "TeamMember"  ADD CONSTRAINT "TeamMember_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "Account"     ADD CONSTRAINT "Account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "Campaign"    ADD CONSTRAINT "Campaign_userId_fkey"
  FOREIGN KEY ("userId")    REFERENCES "User"("id")    ON DELETE CASCADE NOT VALID;
ALTER TABLE "Campaign"    ADD CONSTRAINT "Campaign_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "Conversion"  ADD CONSTRAINT "Conversion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "DecisionRule" ADD CONSTRAINT "DecisionRule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "Log"          ADD CONSTRAINT "Log_userId_fkey"
  FOREIGN KEY ("userId")     REFERENCES "User"("id")     ON DELETE CASCADE NOT VALID;
ALTER TABLE "Log"          ADD CONSTRAINT "Log_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL NOT VALID;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "TeamInvite_token_idx"   ON "TeamInvite"("token");
CREATE INDEX IF NOT EXISTS "TeamInvite_ownerId_idx" ON "TeamInvite"("ownerId");
CREATE INDEX IF NOT EXISTS "TeamInvite_email_idx"   ON "TeamInvite"("email");
CREATE INDEX IF NOT EXISTS "TeamMember_ownerId_idx" ON "TeamMember"("ownerId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx"     ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Campaign_userId_dateFrom_dateTo_idx" ON "Campaign"("userId","dateFrom","dateTo");
CREATE INDEX IF NOT EXISTS "Campaign_userId_status_idx"          ON "Campaign"("userId","status");
CREATE INDEX IF NOT EXISTS "Conversion_userId_createdAt_idx"     ON "Conversion"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "Conversion_userId_campaignId_idx"    ON "Conversion"("userId","campaignId");
CREATE INDEX IF NOT EXISTS "Conversion_clickId_idx"              ON "Conversion"("clickId");
CREATE INDEX IF NOT EXISTS "Log_userId_createdAt_idx"            ON "Log"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "Log_userId_type_idx"                 ON "Log"("userId","type");
