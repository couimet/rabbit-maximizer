-- CreateTable
CREATE TABLE "coderabbit_comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "pull_request_id" INTEGER NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "comment_type" TEXT NOT NULL CHECK ("comment_type" IN ('review_limited', 'review_skipped', 'review_approved', 'review_changes_suggested')),
    "last_body_preview" TEXT,
    "gh_created_at" DATETIME NOT NULL,
    "gh_updated_at" DATETIME NOT NULL,
    "first_seen_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "coderabbit_comment_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "coderabbit_comment_uuid_key" ON "coderabbit_comment"("uuid");
CREATE UNIQUE INDEX "coderabbit_comment_comment_id_is_deleted_key" ON "coderabbit_comment"("comment_id", "is_deleted");
CREATE INDEX "coderabbit_comment_pull_request_id_idx" ON "coderabbit_comment"("pull_request_id");
CREATE INDEX "coderabbit_comment_comment_type_idx" ON "coderabbit_comment"("comment_type");

-- Add coderabbit_skipped to review_queue status CHECK (SQLite requires table rebuild)
PRAGMA foreign_keys=OFF;

CREATE TABLE "review_queue_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "pull_request_id" INTEGER,
    "repo_full_name" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'retriggered', 'reviewed', 'failed', 'coderabbit_skipped')),
    "not_before" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "source_comment_url" TEXT NOT NULL,
    "source_comment_id" INTEGER NOT NULL,
    "trigger_source" TEXT NOT NULL DEFAULT 'scheduler',
    "retrigger_comment_url" TEXT,
    "retriggered_at" DATETIME,
    "failed_at" DATETIME,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "review_queue_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_request" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "review_queue_new" ("id", "uuid", "pull_request_id", "repo_full_name", "pr_number", "pr_title", "status", "not_before", "attempts", "source_comment_url", "source_comment_id", "trigger_source", "retrigger_comment_url", "retriggered_at", "failed_at", "reviewed_at", "created_at", "updated_at")
  SELECT "id", "uuid", "pull_request_id", "repo_full_name", "pr_number", "pr_title", "status", "not_before", "attempts", "source_comment_url", "source_comment_id", "trigger_source", "retrigger_comment_url", "retriggered_at", "failed_at", "reviewed_at", "created_at", "updated_at" FROM "review_queue";
DROP TABLE "review_queue";
ALTER TABLE "review_queue_new" RENAME TO "review_queue";
CREATE INDEX "review_queue_status_not_before_idx" ON "review_queue"("status", "not_before");
CREATE INDEX "review_queue_pull_request_id_idx" ON "review_queue"("pull_request_id");

PRAGMA foreign_keys=ON;
