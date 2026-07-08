-- Step 1: Add column as nullable (no default — only set when retrigger comment is posted)
ALTER TABLE "review_queue" ADD COLUMN "retrigger_comment_url" TEXT;
