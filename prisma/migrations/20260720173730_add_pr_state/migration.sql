-- Add pr_state column to pull_request with CHECK constraint
ALTER TABLE "pull_request" ADD COLUMN "pr_state" TEXT NOT NULL DEFAULT 'open' CHECK("pr_state" IN ('open', 'merged', 'closed'));
