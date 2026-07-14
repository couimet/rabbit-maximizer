-- Update events.type CHECK constraint to include the new event types from the
-- completed-renamed-to-reviewed change (PR #165). The legacy 'completed' value
-- is kept for historical rows (196 events in the DB).
--
-- SQLite does not support ALTER CONSTRAINT, so we rebuild the table. Column
-- names are listed explicitly to avoid ordering mismatches.

PRAGMA foreign_keys = OFF;

CREATE TABLE "new_events" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
  "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL
    CHECK (
      "type" IN (
        'detected', 'enqueued', 'retriggered', 'bypassed',
        'completed', 'failed',
        'coderabbit_review_approved', 'coderabbit_review_changes_requested',
        'title_changed'
      )
      AND length("type") <= 50
    ),
  "pull_request_id" INTEGER,
  "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
  "pr_number" INTEGER NOT NULL,
  "correlation_id" TEXT NOT NULL CHECK (length("correlation_id") <= 73),
  "request_id" TEXT CHECK (length("request_id") <= 73),
  "version" TEXT NOT NULL CHECK (length("version") <= 32),
  "payload" TEXT NOT NULL CHECK (length("payload") <= 16384),
  "metadata" TEXT CHECK (length("metadata") <= 2048),
  FOREIGN KEY ("pull_request_id") REFERENCES "pull_request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_events" (
  "id", "uuid", "ts", "type", "pull_request_id",
  "repo_full_name", "pr_number", "correlation_id", "request_id",
  "version", "payload", "metadata"
)
SELECT
  "id", "uuid", "ts", "type", "pull_request_id",
  "repo_full_name", "pr_number", "correlation_id", "request_id",
  "version", "payload", "metadata"
FROM "events";

DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";

CREATE INDEX "events_repo_pr_ts_idx" ON "events"("repo_full_name", "pr_number", "ts");
CREATE INDEX "events_pull_request_id_idx" ON "events"("pull_request_id");
CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");

PRAGMA foreign_keys = ON;
