-- Add merged_at and closed_at columns to pull_request with CHECK constraint.
-- A PR cannot be both merged and closed-without-merge, enforced by a multi-column CHECK.
-- SQLite does not support ALTER TABLE ADD CHECK for multi-column constraints,
-- so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE "pull_request_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author_login" TEXT NOT NULL,
    "pr_state" TEXT NOT NULL DEFAULT 'open' CHECK("pr_state" IN ('open', 'merged', 'closed')),
    "merged_at" DATETIME,
    "closed_at" DATETIME,
    "first_seen_at" DATETIME NOT NULL,
    "first_review_limit_at" DATETIME,
    "last_review_limit_at" DATETIME,
    "last_review_requested_at" DATETIME,
    "last_coderabbit_review_at" DATETIME,
    "last_review_url" TEXT CHECK("last_review_url" IS NULL OR length("last_review_url") <= 512),
    "last_review_state" TEXT CHECK("last_review_state" IS NULL OR (length("last_review_state") <= 25 AND "last_review_state" IN ('review_approved', 'review_changes_suggested'))),
    "last_coderabbit_acknowledged_at" DATETIME,
    "retrigger_count" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ("merged_at" IS NULL OR "closed_at" IS NULL)
);

INSERT INTO "pull_request_new" (
    "id", "uuid", "repo_full_name", "pr_number", "title", "author_login",
    "pr_state", "merged_at", "closed_at",
    "first_seen_at", "first_review_limit_at", "last_review_limit_at",
    "last_review_requested_at", "last_coderabbit_review_at",
    "last_review_url", "last_review_state",
    "last_coderabbit_acknowledged_at",
    "retrigger_count", "review_count", "created_at", "updated_at"
)
SELECT
    "id", "uuid", "repo_full_name", "pr_number", "title", "author_login",
    "pr_state", NULL, NULL,
    "first_seen_at", "first_review_limit_at", "last_review_limit_at",
    "last_review_requested_at", "last_coderabbit_review_at",
    "last_review_url", "last_review_state",
    "last_coderabbit_acknowledged_at",
    "retrigger_count", "review_count", "created_at", "updated_at"
FROM "pull_request";

DROP TABLE "pull_request";

ALTER TABLE "pull_request_new" RENAME TO "pull_request";

PRAGMA foreign_key_check;

PRAGMA foreign_keys = ON;

-- Recreate indexes
CREATE UNIQUE INDEX "pull_request_uuid_key" ON "pull_request"("uuid");
CREATE UNIQUE INDEX "pull_request_repo_full_name_pr_number_key" ON "pull_request"("repo_full_name", "pr_number");
CREATE INDEX "pull_request_last_coderabbit_acknowledged_at_idx" ON "pull_request"("last_coderabbit_acknowledged_at");
CREATE INDEX "pull_request_last_coderabbit_review_at_idx" ON "pull_request"("last_coderabbit_review_at");
CREATE INDEX "pull_request_last_review_requested_at_idx" ON "pull_request"("last_review_requested_at");
