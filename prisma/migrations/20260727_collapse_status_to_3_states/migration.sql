-- Rebuild review_queue to collapse status to 3 values and add resolution/resolved_at.
-- SQLite cannot alter CHECK constraints, so the table is recreated.
-- Status mapping:
--   pending, retriggered     → unchanged (lifecycle states)
--   reviewed                 → resolved / resolution='review_completed'
--   failed                   → resolved / resolution='failed'
--   coderabbit_skipped       → resolved / resolution='skipped'
--   pr_merged                → resolved / resolution='pr_merged'
--   pr_closed_without_merge  → resolved / resolution='pr_closed_without_merge'
PRAGMA foreign_keys = OFF;

CREATE TABLE "new_review_queue" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL,
  "pull_request_id" INTEGER,
  "repo_full_name" TEXT NOT NULL,
  "pr_number" INTEGER NOT NULL,
  "pr_title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "resolution" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "source_comment_url" TEXT NOT NULL,
  "source_comment_id" INTEGER NOT NULL,
  "trigger_source" TEXT NOT NULL DEFAULT 'scheduler',
  "retrigger_comment_url" TEXT,
  "retriggered_at" DATETIME,
  "failed_at" DATETIME,
  "reviewed_at" DATETIME,
  "resolved_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT (datetime('now')),
  "updated_at" DATETIME NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "review_queue_status_check" CHECK ("status" IN ('pending', 'retriggered', 'resolved')),
  CONSTRAINT "review_queue_trigger_source_check" CHECK ("trigger_source" IN ('dashboard_retrigger_now', 'scheduler')),
  CONSTRAINT "review_queue_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_review_queue" (
  "id", "uuid", "pull_request_id", "repo_full_name", "pr_number", "pr_title",
  "status", "resolution",
  "attempts",
  "source_comment_url", "source_comment_id", "trigger_source",
  "retrigger_comment_url", "retriggered_at", "failed_at",
  "reviewed_at", "resolved_at",
  "created_at", "updated_at"
)
SELECT
  "id", "uuid", "pull_request_id", "repo_full_name", "pr_number", "pr_title",
  CASE "status"
    WHEN 'pending' THEN 'pending'
    WHEN 'retriggered' THEN 'retriggered'
    ELSE 'resolved'
  END,
  CASE "status"
    WHEN 'reviewed' THEN 'review_completed'
    WHEN 'failed' THEN 'failed'
    WHEN 'coderabbit_skipped' THEN 'skipped'
    WHEN 'pr_merged' THEN 'pr_merged'
    WHEN 'pr_closed_without_merge' THEN 'pr_closed_without_merge'
    ELSE NULL
  END,
  "attempts",
  "source_comment_url", "source_comment_id", "trigger_source",
  "retrigger_comment_url", "retriggered_at", "failed_at",
  "reviewed_at",
  CASE "status"
    WHEN 'pending' THEN NULL
    WHEN 'retriggered' THEN NULL
    ELSE COALESCE("reviewed_at", "failed_at", "updated_at")
  END,
  "created_at", "updated_at"
FROM "review_queue";

DROP TABLE "review_queue";

ALTER TABLE "new_review_queue" RENAME TO "review_queue";

-- Recreate all 5 indexes from the original table (C010)
CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");
CREATE INDEX "review_queue_pull_request_id_idx" ON "review_queue"("pull_request_id");
CREATE INDEX "review_queue_status_idx" ON "review_queue"("status");
CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue"("repo_full_name", "pr_number") WHERE "status" = 'pending';
CREATE UNIQUE INDEX "review_queue_source_comment_id_unique" ON "review_queue"("source_comment_id");

PRAGMA foreign_keys = ON;
