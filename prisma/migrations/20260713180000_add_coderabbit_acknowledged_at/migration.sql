-- Add last_coderabbit_acknowledged_at to PullRequest.
--
-- CodeRabbit emits three distinct signals, each with its own timestamp column:
--   1. Acknowledgement: "Sure, I'll perform a full review of all the changes in
--      this PR again." — CodeRabbit received our retrigger and will process it.
--      → last_coderabbit_acknowledged_at (this column)
--   2. Rate-limit: "You've reached your PR review rate limit." — CodeRabbit
--      cannot review because of free-tier caps.
--      → last_review_limit_at (already exists)
--   3. Review completed: "No actionable comments were generated" or "Actionable
--      comments posted:" — CodeRabbit finished the review with a verdict.
--      → last_coderabbit_review_at (already exists)
--
-- The scheduler uses the acknowledgement signal for retrigger spacing: after WE
-- post a retrigger (last_review_requested_at = now), the scheduler skips ticks
-- until CodeRabbit acknowledges (last_coderabbit_acknowledged_at >=
-- last_review_requested_at), confirming the retrigger was received and is being
-- processed. Without this column, the scheduler cannot distinguish "CodeRabbit
-- hasn't responded yet" from "CodeRabbit is working on it."

ALTER TABLE "pull_request" ADD COLUMN "last_coderabbit_acknowledged_at" DATETIME;
CREATE INDEX "pull_request_last_coderabbit_acknowledged_at_idx" ON "pull_request"("last_coderabbit_acknowledged_at");
