-- Add trigger_source column to track how a retrigger was initiated.
-- Nullable TEXT column — SQLite supports ALTER TABLE ADD COLUMN for nullable columns.
ALTER TABLE "review_queue" ADD COLUMN "trigger_source" TEXT;

-- Backfill existing rows: everything created before this column existed was
-- enqueued by the scheduler.
UPDATE "review_queue" SET "trigger_source" = 'scheduler' WHERE "trigger_source" IS NULL;
