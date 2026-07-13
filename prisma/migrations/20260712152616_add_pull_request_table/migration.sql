CREATE TABLE "pull_request" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL,
  "repo_full_name" TEXT NOT NULL,
  "pr_number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "author_login" TEXT NOT NULL,
  "first_seen_at" DATETIME NOT NULL,
  "first_review_limit_at" DATETIME,
  "last_review_limit_at" DATETIME,
  "last_review_requested_at" DATETIME,
  "last_coderabbit_review_at" DATETIME,
  "retrigger_count" INTEGER NOT NULL DEFAULT 0,
  "review_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "pull_request_uuid_key" ON "pull_request"("uuid");
CREATE UNIQUE INDEX "pull_request_repo_full_name_pr_number_key" ON "pull_request"("repo_full_name", "pr_number");
CREATE INDEX "pull_request_last_coderabbit_review_at_idx" ON "pull_request"("last_coderabbit_review_at");
CREATE INDEX "pull_request_last_review_requested_at_idx" ON "pull_request"("last_review_requested_at");

ALTER TABLE "review_queue" ADD COLUMN "pull_request_id" INTEGER REFERENCES "pull_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "review_queue_pull_request_id_idx" ON "review_queue"("pull_request_id");

ALTER TABLE "events" ADD COLUMN "pull_request_id" INTEGER REFERENCES "pull_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "events_pull_request_id_idx" ON "events"("pull_request_id");
