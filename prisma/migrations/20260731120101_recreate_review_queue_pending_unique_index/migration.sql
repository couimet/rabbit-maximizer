-- Recreate the review_queue_pending_unique partial unique index that was
-- lost during a prior migration. This index enforces at most one pending
-- queue item per PR.

CREATE UNIQUE INDEX IF NOT EXISTS "review_queue_pending_unique" ON "review_queue"("repo_full_name", "pr_number") WHERE "status" = 'pending';
