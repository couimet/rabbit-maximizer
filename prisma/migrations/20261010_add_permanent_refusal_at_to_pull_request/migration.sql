-- Holds a permanently-refused PR out of the stale-PR recovery query (BR-10-4).
-- Detection sets it when a refusal resolves the PR's queue item, and the operator
-- re-queue action clears it. A nullable column needs no table rebuild.

ALTER TABLE "pull_request" ADD COLUMN "permanent_refusal_at" DATETIME;
