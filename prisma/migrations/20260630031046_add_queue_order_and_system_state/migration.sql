-- RenameColumn (Prisma does not generate RENAME COLUMN)
ALTER TABLE "review_queue" RENAME COLUMN "scheduled_for" TO "not_before";

-- Migrate enqueued event payloads from old column name (scheduled_for → not_before)
UPDATE "events"
SET "payload" = json_set(
  json_remove("payload", '$.scheduled_for'),
  '$.not_before',
  json_extract("payload", '$.scheduled_for')
)
WHERE "type" = 'enqueued'
  AND json_extract("payload", '$.scheduled_for') IS NOT NULL;

-- RenameIndex (SQLite does not support ALTER INDEX RENAME)
DROP INDEX "review_queue_status_scheduled_for_idx";
CREATE INDEX "review_queue_status_not_before_idx" ON "review_queue"("status", "not_before");

-- AlterTable
ALTER TABLE "review_queue" ADD COLUMN "completed_at" DATETIME;
ALTER TABLE "review_queue" ADD COLUMN "failed_at" DATETIME;
ALTER TABLE "review_queue" ADD COLUMN "posted_at" DATETIME;

-- CreateTable
CREATE TABLE "queue_order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "queue_item_id" INTEGER NOT NULL,
    "position" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "queue_order_queue_item_id_fkey" FOREIGN KEY ("queue_item_id") REFERENCES "review_queue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_state" (
    "state_key" TEXT NOT NULL PRIMARY KEY,
    "value_text" TEXT,
    "value_integer" INTEGER,
    "value_float" REAL,
    "value_datetime" TEXT,
    "updated_at" TEXT NOT NULL,
    CHECK (
        (CASE WHEN "value_text"     IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN "value_integer"  IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN "value_float"    IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN "value_datetime" IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "queue_order_queue_item_id_key" ON "queue_order"("queue_item_id");

-- Seed system_state with initial keys (exactly one value column must be non-null per row)
INSERT INTO "system_state" ("state_key", "value_text", "value_datetime", "updated_at") VALUES
    ('last_poll_started_at', NULL, datetime('now'), datetime('now')),
    ('last_poll_completed_at', NULL, datetime('now'), datetime('now')),
    ('last_poll_outcome', 'success', NULL, datetime('now')),
    ('scheduler_status', 'running', NULL, datetime('now')),
    ('next_review_available_at', NULL, datetime('now'), datetime('now'));

-- Backfill queue_order rows for existing pending items
INSERT INTO "queue_order" ("queue_item_id", "updated_at") SELECT "id", datetime('now') FROM "review_queue" WHERE "status" = 'pending' ORDER BY "id" ASC;
