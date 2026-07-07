-- Add the nullable column first
ALTER TABLE "review_queue" ADD COLUMN "source_comment_id" INTEGER;

-- Backfill from source_comment_url: extract numeric ID after "#issuecomment-"
UPDATE "review_queue"
SET "source_comment_id" = CAST(
  SUBSTR(
    "source_comment_url",
    INSTR("source_comment_url", '#issuecomment-') + LENGTH('#issuecomment-')
  ) AS INTEGER
)
WHERE "source_comment_url" IS NOT NULL
  AND INSTR("source_comment_url", '#issuecomment-') > 0;

-- Now make it mandatory — every row must have a comment ID
-- SQLite doesn't support ALTER COLUMN, so we recreate the table
PRAGMA foreign_keys = OFF;

CREATE TABLE "review_queue_new" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL,
  "repo_full_name" TEXT NOT NULL,
  "pr_number" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "not_before" DATETIME NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "source_comment_url" TEXT NOT NULL,
  "source_comment_id" INTEGER NOT NULL,
  "retriggered_at" DATETIME,
  "failed_at" DATETIME,
  "completed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "review_queue_new"
  ("id", "uuid", "repo_full_name", "pr_number", "status", "not_before", "attempts", "source_comment_url", "source_comment_id", "retriggered_at", "failed_at", "completed_at", "created_at", "updated_at")
SELECT
  "id", "uuid", "repo_full_name", "pr_number", "status", "not_before", "attempts", "source_comment_url", "source_comment_id", "retriggered_at", "failed_at", "completed_at", "created_at", "updated_at"
FROM "review_queue";

DROP TABLE "review_queue";
ALTER TABLE "review_queue_new" RENAME TO "review_queue";

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");
CREATE INDEX "review_queue_status_not_before_idx" ON "review_queue"("status", "not_before");
