-- Rename posted → retriggered in column names, status values, and event types.
-- SQLite does not support ALTER CHECK, so we recreate both tables.

-- 1. Recreate review_queue with updated CHECK constraint and renamed column
CREATE TABLE "new_review_queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
      CHECK ("status" IN ('pending', 'retriggered', 'completed', 'failed') AND length("status") <= 25),
    "not_before" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "source_comment_url" TEXT CHECK (length("source_comment_url") <= 512),
    "retriggered_at" DATETIME,
    "failed_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

INSERT INTO "new_review_queue" (
    "id", "uuid", "repo_full_name", "pr_number", "status",
    "not_before", "attempts", "source_comment_url", "retriggered_at",
    "failed_at", "completed_at", "created_at", "updated_at"
)
SELECT
    "id", "uuid", "repo_full_name", "pr_number",
    CASE WHEN "status" = 'posted' THEN 'retriggered' ELSE "status" END,
    "not_before", "attempts", "source_comment_url", "posted_at",
    "failed_at", "completed_at", "created_at", "updated_at"
FROM "review_queue";

DROP TABLE "review_queue";

ALTER TABLE "new_review_queue" RENAME TO "review_queue";

-- 2. Recreate events with updated CHECK constraint, remapping 'posted' to 'retriggered'
CREATE TABLE "new_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL
      CHECK ("type" IN ('detected', 'enqueued', 'retriggered', 'bypassed', 'completed', 'failed') AND length("type") <= 25),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "correlation_id" TEXT NOT NULL CHECK (length("correlation_id") <= 73),
    "request_id" TEXT CHECK (length("request_id") <= 73),
    "version" TEXT NOT NULL CHECK (length("version") <= 32),
    "payload" TEXT NOT NULL CHECK (length("payload") <= 16384),
    "metadata" TEXT CHECK (length("metadata") <= 2048)
);

INSERT INTO "new_events" ("id", "uuid", "ts", "type", "repo_full_name", "pr_number", "correlation_id", "request_id", "version", "payload", "metadata")
SELECT "id", "uuid", "ts",
  CASE WHEN "type" = 'posted' THEN 'retriggered' ELSE "type" END,
  "repo_full_name", "pr_number", "correlation_id", "request_id", "version",
  REPLACE("payload", '"posted_comment_url"', '"retriggered_comment_url"'),
  "metadata"
FROM "events";

DROP TABLE "events";

ALTER TABLE "new_events" RENAME TO "events";

-- 3. Recreate indexes
CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");

CREATE INDEX "review_queue_status_not_before_idx" ON "review_queue"("status", "not_before");

CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue" ("repo_full_name", "pr_number") WHERE "status" = 'pending';

CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");

CREATE INDEX "events_repo_pr_ts_idx" ON "events"("repo_full_name", "pr_number", "ts");
