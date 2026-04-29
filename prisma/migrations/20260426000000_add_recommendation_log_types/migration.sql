-- Add two new LogType values for user decisions on engine recommendations
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'RECOMMENDATION_APPROVED';
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'RECOMMENDATION_IGNORED';
