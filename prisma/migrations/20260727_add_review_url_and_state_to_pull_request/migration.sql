-- Add review verdict columns to pull_request with CHECK constraints.
-- Max lengths mirror src/schemas/lengths.ts.
-- Nullable: rows backfilled by future detections fill these in, historical rows stay NULL.
ALTER TABLE "pull_request" ADD COLUMN "last_review_url" TEXT CHECK("last_review_url" IS NULL OR length("last_review_url") <= 512);
ALTER TABLE "pull_request" ADD COLUMN "last_review_state" TEXT CHECK("last_review_state" IS NULL OR length("last_review_state") <= 25);
