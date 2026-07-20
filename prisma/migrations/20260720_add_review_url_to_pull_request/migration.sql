-- Add review URL and state columns to pull_request for denormalized review metadata
ALTER TABLE "pull_request" ADD COLUMN "last_review_url" TEXT;
ALTER TABLE "pull_request" ADD COLUMN "last_review_state" TEXT;
