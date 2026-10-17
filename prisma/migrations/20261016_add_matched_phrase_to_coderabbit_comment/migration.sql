-- The operator must read which configured phrase decided a classification, and the pause
-- shares its classification with the explicit skip. The phrase and its offset are therefore
-- the evidence. The stored body is also truncated today, so the marker can fall outside it.
-- SQLite renames a column and adds a column in place: every index, the CHECK constraint, and
-- the foreign key stay as they are.

ALTER TABLE "coderabbit_comment" RENAME COLUMN "last_body_preview" TO "last_body";
ALTER TABLE "coderabbit_comment" ADD COLUMN "last_matched_phrase" TEXT;
ALTER TABLE "coderabbit_comment" ADD COLUMN "last_matched_offset" INTEGER;

-- A comment that carries the pause note while its stored type is 'unknown' predates the pause
-- classification. Only an open pull request is repaired: a merged or closed one holds no
-- waiting work. The one-second step back on last_seen_at opens the DirectCommentChecker
-- freshness gate, so the tick after this migration re-reads the comment and enqueues it.
UPDATE "coderabbit_comment"
SET "comment_type" = 'review_skipped',
    "last_matched_phrase" = 'review paused by coderabbit.ai',
    "last_matched_offset" = instr("last_body", 'review paused by coderabbit.ai') - 1,
    "last_seen_at" = datetime("gh_updated_at", '-1 second')
WHERE "comment_type" = 'unknown'
  AND "last_body" LIKE '%review paused by coderabbit.ai%'
  AND "pull_request_id" IN (SELECT "id" FROM "pull_request" WHERE "pr_state" = 'open');
