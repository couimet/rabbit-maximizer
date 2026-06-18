-- ============================================================================
-- review_queue
--
-- Tracks PRs that need (or have received) a review retrigger.
--
-- Column notes:
--   id              Internal auto-increment PK (pagination, FKs).
--   uuid            External-facing stable identifier (UUID v4).
--   scheduled_for   When the scheduler should next attempt (our timestamp).
-- ============================================================================

CREATE TABLE "review_queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
      CHECK ("status" IN ('pending', 'completed', 'failed')),
    "scheduled_for" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- ============================================================================
-- events
--
-- Append-only audit / debug log. One row per lifecycle transition.
--
-- Timestamps:
--   ts          Set by us when we record the event (DEFAULT CURRENT_TIMESTAMP).
--   source_ts   Timestamp from the incoming event payload, when available.
--               Null when the event source doesn't provide one.
--
-- Other columns:
--   id          Internal auto-increment PK.
--   uuid        External-facing stable identifier (UUID v4).
-- ============================================================================

CREATE TABLE "events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_ts" DATETIME,
    "type" TEXT NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "source_comment_url" TEXT,
    "posted_comment_url" TEXT,
    "attempt_no" INTEGER,
    "scheduled_for" DATETIME,
    "outcome" TEXT,
    "new_wait" TEXT,
    "detail" TEXT
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");

CREATE INDEX "review_queue_status_scheduled_for_idx" ON "review_queue"("status", "scheduled_for");

CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");

-- Partial unique index: a PR can be re-queued after completion, but never
-- double-queued while pending. Prisma does not support WHERE on @@unique, so
-- this is added as raw SQL.
CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue" ("repo_full_name", "pr_number") WHERE "status" = 'pending';
