-- Fix events CHECK constraint: add coderabbit_review_* types, remove dead
-- 'completed' value, increase type length limit from 25 to 40.
-- SQLite does not support ALTER CHECK, so we recreate the table.

CREATE TABLE "new_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL
      CHECK ("type" IN (
        'detected',
        'enqueued',
        'retriggered',
        'bypassed',
        'failed',
        'coderabbit_review_approved',
        'coderabbit_review_changes_suggested',
        'coderabbit_review_skipped'
      ) AND length("type") <= 40),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "correlation_id" TEXT NOT NULL CHECK (length("correlation_id") <= 73),
    "request_id" TEXT CHECK (length("request_id") <= 73),
    "version" TEXT NOT NULL CHECK (length("version") <= 32),
    "payload" TEXT NOT NULL CHECK (length("payload") <= 16384),
    "metadata" TEXT CHECK (length("metadata") <= 2048),
    "pull_request_id" INTEGER REFERENCES "pull_request"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_events" ("id", "uuid", "ts", "type", "repo_full_name", "pr_number", "correlation_id", "request_id", "version", "payload", "metadata", "pull_request_id")
SELECT "id", "uuid", "ts", "type", "repo_full_name", "pr_number", "correlation_id", "request_id", "version", "payload", "metadata", "pull_request_id"
FROM "events";

DROP TABLE "events";

ALTER TABLE "new_events" RENAME TO "events";

CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");

CREATE INDEX "events_repo_pr_ts_idx" ON "events"("repo_full_name", "pr_number", "ts");

CREATE INDEX "events_pull_request_id_idx" ON "events"("pull_request_id");
