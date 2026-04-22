-- Remove AutomationRule table
DROP TABLE IF EXISTS "AutomationRule";

-- Remove enums
DROP TYPE IF EXISTS "RuleCondition";
DROP TYPE IF EXISTS "RuleAction";

-- Remove automationPaused from Campaign
ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "automationPaused";

-- Add time window to DecisionRule
ALTER TABLE "DecisionRule" ADD COLUMN IF NOT EXISTS "timeWindowStart" INTEGER;
ALTER TABLE "DecisionRule" ADD COLUMN IF NOT EXISTS "timeWindowEnd" INTEGER;
