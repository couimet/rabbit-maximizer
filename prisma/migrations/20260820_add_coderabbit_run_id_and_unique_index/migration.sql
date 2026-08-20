ALTER TABLE "coderabbit_comment" ADD COLUMN "coderabbit_run_id" TEXT CHECK(length(coderabbit_run_id) <= 75);

-- Restore the review_queue_source_comment_id_unique index created by the 20260720 and
-- 20260727 migrations. No later migration drops it, but the dev database lost it outside
-- the migration trail (its _prisma_migrations history shows repeated 20260720 apply
-- attempts), which let duplicate source_comment_id rows accumulate. Fresh databases
-- never lost it; this restores parity.
CREATE UNIQUE INDEX IF NOT EXISTS "review_queue_source_comment_id_unique" ON "review_queue"("source_comment_id");
