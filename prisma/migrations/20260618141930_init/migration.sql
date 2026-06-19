-- ============================================================================
-- review_queue
--
-- Tracks PRs that need (or have received) a review retrigger.
--
-- Column notes:
--   id              Internal auto-increment PK (pagination, FKs).
--   uuid            External-facing stable identifier (UUID v4).
--   scheduled_for   When the scheduler should next attempt (our timestamp).
--
-- String length CHECKs mirror src/schemas/lengths.ts (SQLite has no varchar(n),
-- so lengths are enforced here as CHECK constraints). Keep the two in sync.
-- repo_full_name 140 = GitHub owner/org (<=39) + "/" + repo name (<=100):
--   username/org cap (official): https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/username-considerations-for-external-authentication
--   repo-name cap (community-maintained): https://github.com/dead-claudia/github-limits
-- ============================================================================

CREATE TABLE "review_queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
      CHECK ("status" IN ('pending', 'completed', 'failed') AND length("status") <= 25),
    "scheduled_for" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- ============================================================================
-- events
--
-- Append-only audit / debug log. One row per lifecycle transition, stored in a
-- three-tier shape:
--   envelope    Always-present, queried columns (ts, type, repo_full_name,
--               pr_number, correlation_id, request_id, version).
--   payload     Type-specific fields as a JSON blob; new event types add a new
--               payload shape with no migration.
--   metadata    Rarely-queried provenance (git sha, build id, host, node
--               version) as a JSON blob.
--
--   id          Internal auto-increment PK.
--   uuid        External-facing stable identifier (UUID v4).
--   ts          Set by us when we record the event (DEFAULT CURRENT_TIMESTAMP).
--
-- String length CHECKs mirror src/schemas/lengths.ts; correlation_id/request_id
-- 73 = two UUID v4 (36 each) + 1 delimiter.
-- ============================================================================

CREATE TABLE "events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL CHECK (length("uuid") <= 36),
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL
      CHECK ("type" IN ('detected', 'enqueued', 'posted', 'rejected', 'completed', 'failed') AND length("type") <= 25),
    "repo_full_name" TEXT NOT NULL CHECK (length("repo_full_name") <= 140),
    "pr_number" INTEGER NOT NULL,
    "correlation_id" TEXT NOT NULL CHECK (length("correlation_id") <= 73),
    "request_id" TEXT CHECK (length("request_id") <= 73),
    "version" TEXT NOT NULL CHECK (length("version") <= 32),
    "payload" TEXT NOT NULL CHECK (length("payload") <= 16384),
    "metadata" TEXT CHECK (length("metadata") <= 2048)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE UNIQUE INDEX "review_queue_uuid_key" ON "review_queue"("uuid");

CREATE INDEX "review_queue_status_scheduled_for_idx" ON "review_queue"("status", "scheduled_for");

CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");

CREATE INDEX "events_repo_pr_ts_idx" ON "events"("repo_full_name", "pr_number", "ts");

-- Partial unique index: a PR can be re-queued after completion, but never
-- double-queued while pending. Prisma does not support WHERE on @@unique, so
-- this is added as raw SQL.
CREATE UNIQUE INDEX "review_queue_pending_unique" ON "review_queue" ("repo_full_name", "pr_number") WHERE "status" = 'pending';
