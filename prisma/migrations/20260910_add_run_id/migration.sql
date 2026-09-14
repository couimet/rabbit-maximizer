-- Our own run id, printed as `run=` in the posted retrigger comment footer.
-- Nullable: only retriggered events and retriggered queue items carry one.
ALTER TABLE "events" ADD COLUMN "run_id" TEXT CHECK(length("run_id") <= 36);

-- CreateIndex
CREATE INDEX "events_run_id_idx" ON "events"("run_id");

-- AlterTable
ALTER TABLE "review_queue" ADD COLUMN "run_id" TEXT CHECK(length("run_id") <= 36);
