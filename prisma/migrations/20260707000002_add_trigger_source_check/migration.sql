-- Add CHECK constraint on review_queue.trigger_source to enforce only
-- valid TriggerSource values at the database level. Also make the column
-- NOT NULL since every row has it (backfilled, all writes set it).
-- SQLite does not support ALTER TABLE ADD CHECK, so we recreate the table.

-- Disable foreign keys so the queue_order → review_queue FK does not cascade-delete during the rebuild.
PRAGMA foreign_keys = OFF;

CREATE TABLE "new_review_queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
      CHECK ("status" IN ('pending', 'retriggered', 'completed', 'failed') AND length("status") <= 25),
    "not_before" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "source_comment_url" TEXT NOT NULL CHECK (length("source_comment_url") <= 512),
    "source_comment_id" INTEGER NOT NULL,
    "trigger_source" TEXT NOT NULL DEFAULT 'scheduler'
      CHECK ("trigger_source" IN ('dashboard_retrigger_now', 'scheduler') AND length("trigger_source") <= 25),
    "retriggered_at" DATETIME,
    "failed_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- COALESCE handles rows that predate the backfill (shouldn't exist, but safe).
INSERT INTO "new_review_queue" (
    "id", "uuid", "repo_full_name", "pr_number", "status",
    "not_before", "attempts", "source_comment_url", "source_comment_id", "trigger_source",
    "retriggered_at", "failed_at", "completed_at", "created_at", "updated_at"
)
SELECT
    "id", "uuid", "repo_full_name", "pr_number", "status",
    "not_before", "attempts", "source_comment_url", "source_comment_id",
    COALESCE("trigger_source", 'scheduler'),
    "retriggered_at", "failed_at", "completed_at", "created_at", "updated_at"
FROM "review_queue";

DROP TABLE "review_queue";

ALTER TABLE "new_review_queue" RENAME TO "review_queue";

PRAGMA foreign_key_check;

PRAGMA foreign_keys = ON;

-- Recreate indexes
CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");

CREATE INDEX "review_queue_status_not_before_idx" ON "review_queue"("status", "not_before");

CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue" ("repo_full_name", "pr_number") WHERE "status" = 'pending';
