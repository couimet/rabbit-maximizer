-- Remove duplicate pending rows, keeping the earliest (lowest id) per (repo, PR) pair.
-- queue_order rows cascade via the foreign key ON DELETE CASCADE.
DELETE FROM "review_queue"
WHERE "status" = 'pending'
  AND "id" NOT IN (
    SELECT "min_id" FROM (
      SELECT MIN("id") AS "min_id"
      FROM "review_queue"
      WHERE "status" = 'pending'
      GROUP BY "repo_full_name", "pr_number"
    )
  );

-- Recreate the partial unique index that was accidentally omitted when this table
-- was rebuilt in migration 20260707000000_add_source_comment_id.
CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue"
  ("repo_full_name", "pr_number") WHERE "status" = 'pending';
