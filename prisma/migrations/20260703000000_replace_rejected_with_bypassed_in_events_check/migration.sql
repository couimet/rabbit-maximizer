-- Replace 'rejected' with 'bypassed' in the events.type CHECK constraint.
-- SQLite does not support ALTER CHECK, so we recreate the table.

-- 1. Create new table with the updated CHECK constraint
CREATE TABLE "new_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL
      CHECK ("type" IN ('detected', 'enqueued', 'posted', 'bypassed', 'completed', 'failed') AND length("type") <= 25),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "correlation_id" TEXT NOT NULL CHECK (length("correlation_id") <= 73),
    "request_id" TEXT CHECK (length("request_id") <= 73),
    "version" TEXT NOT NULL CHECK (length("version") <= 32),
    "payload" TEXT NOT NULL CHECK (length("payload") <= 16384),
    "metadata" TEXT CHECK (length("metadata") <= 2048)
);

-- 2. Copy all existing rows
INSERT INTO "new_events" ("id", "uuid", "ts", "type", "repo_full_name", "pr_number", "correlation_id", "request_id", "version", "payload", "metadata")
SELECT "id", "uuid", "ts", CASE WHEN "type" = 'rejected' THEN 'bypassed' ELSE "type" END, "repo_full_name", "pr_number", "correlation_id", "request_id", "version", "payload", "metadata" FROM "events";

-- 3. Drop the old table
DROP TABLE "events";

-- 4. Rename the new table
ALTER TABLE "new_events" RENAME TO "events";

-- 5. Recreate indexes
CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");
CREATE INDEX "events_repo_pr_ts_idx" ON "events"("repo_full_name", "pr_number", "ts");
