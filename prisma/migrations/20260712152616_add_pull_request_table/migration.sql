-- PullRequest is the canonical home for PR identity and system-observed history.
-- One row per PR. Timestamps are materialized so common queries read a single row
-- instead of scanning review_queue (N rows per PR per lifecycle cycle) or events
-- (N rows per PR per transition).
--
-- Column glossary:
--   id / uuid                    Internal auto-increment PK and external stable identifier.
--   repo_full_name / pr_number   Composite unique key (the GitHub PR identity).
--   title / author_login         Cached from GitHub at detection time. title is updated on
--                                each detection if the search result carries a new value;
--                                author_login is set once at first detection, never updated.
--   first_seen_at                Earliest created_at across all review_queue rows for this PR.
--   first_review_limit_at        Earliest CodeRabbit rate-limit comment timestamp (NULL if
--                                we never saw one). "Review limit" = CodeRabbit told us the
--                                PR hit the free-tier cap.
--   last_review_limit_at         Latest CodeRabbit rate-limit comment timestamp. Updated by
--                                PollDetector each time it finds a (newer) rate-limit comment
--                                on this PR.
--   last_review_requested_at     Last time WE posted a retrigger comment ("@coderabbitai full
--                                review") asking CodeRabbit to re-review. Set by ReviewTrigger
--                                after the comment POST succeeds. NOT CodeRabbit's response —
--                                it records our outgoing request.
--   last_coderabbit_review_at    Last time CodeRabbit completed a review on this PR (approved
--                                or changes-requested). Detected by ReviewDetector via the
--                                GitHub Reviews API or body-matched completed-review heuristic.
--   retrigger_count              How many times WE posted a retrigger comment. Incremented on
--                                each markRetriggered.
--   review_count                 How many times CodeRabbit actually completed a review.
--                                Incremented on each markReviewed.
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
