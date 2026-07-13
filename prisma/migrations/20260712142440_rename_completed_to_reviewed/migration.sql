-- Rebuild review_queue to rename completed_at→reviewed_at and update the status CHECK constraint.
-- SQLite cannot alter CHECK constraints, so the table is recreated.
PRAGMA foreign_keys = OFF;

CREATE TABLE "new_review_queue" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL,
  "repo_full_name" TEXT NOT NULL,
  "pr_number" INTEGER NOT NULL,
  "pr_title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "not_before" DATETIME NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "source_comment_url" TEXT NOT NULL,
  "source_comment_id" INTEGER NOT NULL,
  "trigger_source" TEXT NOT NULL DEFAULT 'scheduler',
  "retrigger_comment_url" TEXT,
  "retriggered_at" DATETIME,
  "failed_at" DATETIME,
  "reviewed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT (datetime('now')),
  "updated_at" DATETIME NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "review_queue_status_check" CHECK ("status" IN ('pending', 'retriggered', 'reviewed', 'failed')),
  CONSTRAINT "review_queue_trigger_source_check" CHECK ("trigger_source" IN ('dashboard_retrigger_now', 'scheduler'))
);

INSERT INTO "new_review_queue" (
  "id", "uuid", "repo_full_name", "pr_number", "pr_title",
  "status", "not_before", "attempts",
  "source_comment_url", "source_comment_id", "trigger_source",
  "retrigger_comment_url", "retriggered_at", "failed_at",
  "reviewed_at", "created_at", "updated_at"
)
SELECT
  "id", "uuid", "repo_full_name", "pr_number", "pr_title",
  CASE "status" WHEN 'completed' THEN 'reviewed' ELSE "status" END,
  "not_before", "attempts",
  "source_comment_url", "source_comment_id", "trigger_source",
  "retrigger_comment_url", "retriggered_at", "failed_at",
  "completed_at", "created_at", "updated_at"
FROM "review_queue";

DROP TABLE "review_queue";

ALTER TABLE "new_review_queue" RENAME TO "review_queue";

CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");
CREATE INDEX "review_queue_status_not_before_idx" ON "review_queue"("status", "not_before");
CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue"("repo_full_name", "pr_number") WHERE "status" = 'pending';

PRAGMA foreign_keys = ON;
