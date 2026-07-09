-- AlterTable
-- DEFAULT backfills existing rows with '(unknown)'.
-- SQLite persists the DEFAULT on the schema (no DROP DEFAULT support), but it is
-- never triggered: every INSERT path explicitly sets pr_title (EnqueueData.prTitle
-- is required). The DEFAULT is purely a migration backfill mechanism.
-- TODO [2026-08-01]: #79 — remove this DEFAULT when the table is rebuilt.
ALTER TABLE "review_queue" ADD COLUMN "pr_title" TEXT NOT NULL DEFAULT '(unknown)';
