-- Fix coderabbit_comment table: the original 20260716_add_coderabbit_comment
-- migration was marked as applied but its SQL was never actually run. The table
-- was created by prisma db push with the pre-PR-feedback schema (is_deleted).
-- This migration rebuilds the table to match the current schema (is_not_deleted).
-- Zero rows in the table at the time this migration was written; data migration
-- is trivial but included for correctness.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_coderabbit_comment" (
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
    "is_not_deleted" BOOLEAN DEFAULT true,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "coderabbit_comment_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_request" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_coderabbit_comment" (
    "id", "uuid", "pull_request_id", "comment_id", "url", "comment_type",
    "last_body_preview", "gh_created_at", "gh_updated_at", "first_seen_at",
    "last_seen_at", "is_not_deleted", "deleted_at", "created_at", "updated_at"
)
SELECT
    "id", "uuid", "pull_request_id", "comment_id", "url", "comment_type",
    "last_body_preview", "gh_created_at", "gh_updated_at", "first_seen_at",
    "last_seen_at",
    CASE WHEN "is_deleted" THEN NULL ELSE true END,
    "deleted_at", "created_at", "updated_at"
FROM "coderabbit_comment";

DROP TABLE "coderabbit_comment";
ALTER TABLE "new_coderabbit_comment" RENAME TO "coderabbit_comment";

CREATE UNIQUE INDEX "coderabbit_comment_uuid_key" ON "coderabbit_comment"("uuid");
CREATE UNIQUE INDEX "coderabbit_comment_comment_id_is_not_deleted_key" ON "coderabbit_comment"("comment_id", "is_not_deleted");
CREATE INDEX "coderabbit_comment_pull_request_id_idx" ON "coderabbit_comment"("pull_request_id");
CREATE INDEX "coderabbit_comment_comment_type_idx" ON "coderabbit_comment"("comment_type");

PRAGMA foreign_keys=ON;
